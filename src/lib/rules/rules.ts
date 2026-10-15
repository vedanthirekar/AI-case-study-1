// Every action passes through checkRules before it is saved. Pure function:
// in production the same code runs on the server. A refusal always says which
// role can do it and why, so the UI can show it on the disabled control.
import type { Model } from '../packet/model'
import { areaOf } from '../packet/areas'
import type { Action, EventType, Payloads, AdjustmentPayload, WPEvent } from '../workpaper/events'
import type { Derived } from '../workpaper/derive'
import { magnitude } from '../workpaper/effect'

export type Role = 'preparer' | 'reviewer' | 'partner' | 'firm_administrator' | 'quality_reviewer' | 'client'

export interface Actor { id: string; name: string; role: Role; clearance: boolean; activeFrom: string; credential: string | null; note?: string }

export const ROLE_LABEL: Record<Role, string> = {
  preparer: 'Preparer', reviewer: 'Reviewer', partner: 'Partner', firm_administrator: 'Firm administrator',
  quality_reviewer: 'Quality reviewer', client: 'Client',
}

export function actorsOf(m: Model): Actor[] {
  const staff: Actor[] = m.packet.firm.staff.map((s) => ({
    id: s.id, name: s.name, role: s.role, clearance: s.sensitive_data_clearance, activeFrom: s.active_from, credential: s.credential, note: s.note,
  }))
  const clients: Actor[] = m.packet.firm.client_users.map((c) => ({ id: c.id, name: c.name, role: 'client', clearance: false, activeFrom: '2026-01-01', credential: null }))
  return [...staff, ...clients]
}

const ALLOWED: Record<Role, EventType[]> = {
  preparer: ['verification.recorded', 'adjustment.proposed', 'finding.dismissed', 'note.created', 'note.resolved', 'thread.message', 'decision.recorded', 'signoff.given', 'sensitive.revealed', 'attachment.added', 'event.reversed'],
  reviewer: ['verification.recorded', 'adjustment.proposed', 'adjustment.approved', 'adjustment.rejected', 'finding.dismissed', 'note.created', 'note.resolved', 'thread.message', 'decision.recorded', 'signoff.given', 'sensitive.revealed', 'attachment.added', 'event.reversed'],
  partner: ['verification.recorded', 'adjustment.proposed', 'adjustment.approved', 'adjustment.rejected', 'finding.dismissed', 'note.created', 'note.resolved', 'thread.message', 'decision.recorded', 'signoff.given', 'sensitive.revealed', 'attachment.added', 'event.reversed'],
  firm_administrator: ['note.created', 'sensitive.revealed', 'event.reversed'],
  quality_reviewer: ['note.created', 'note.resolved'],
  client: ['thread.message', 'attachment.added'],
}

/** Which roles may take this kind of action, for the "who can" message. */
function whoCan(type: EventType): string {
  const roles = (Object.keys(ALLOWED) as Role[]).filter((r) => ALLOWED[r].includes(type)).map((r) => ROLE_LABEL[r].toLowerCase())
  return roles.length ? roles.join(', ') : 'no role'
}

const VERB: Partial<Record<EventType, string>> = {
  'verification.recorded': 'record a verification', 'adjustment.proposed': 'propose an adjustment',
  'adjustment.approved': 'approve an adjustment', 'adjustment.rejected': 'reject an adjustment',
  'finding.dismissed': 'dismiss a finding', 'signoff.given': 'sign off', 'decision.recorded': 'record a decision',
  'sensitive.revealed': 'reveal sensitive data', 'note.resolved': 'resolve a note',
}

export type Verdict = { ok: true } | { ok: false; reason: string }
const no = (reason: string): Verdict => ({ ok: false, reason })
const OK: Verdict = { ok: true }

export const PARTNER_THRESHOLD = 1000

export function checkRules(_m: Model, d: Derived, actor: Actor, action: Action, simNow: string, events: WPEvent[]): Verdict {
  if (simNow.slice(0, 10) < actor.activeFrom) {
    return no(`${actor.name} does not join the firm until ${actor.activeFrom}. Move the season clock forward or switch person.`)
  }
  if (!ALLOWED[actor.role].includes(action.type)) {
    const verb = VERB[action.type] ?? 'do this'
    return no(`A ${ROLE_LABEL[actor.role].toLowerCase()} cannot ${verb}. Allowed for: ${whoCan(action.type)}.`)
  }

  switch (action.type) {
    case 'sensitive.revealed':
      if (!actor.clearance) return no(`${actor.name} has no sensitive-data clearance${actor.note ? ` (${actor.note})` : ''}. Staff with clearance can reveal it.`)
      return OK

    case 'adjustment.approved':
    case 'adjustment.rejected': {
      const p = action.payload as Payloads['adjustment.approved']
      const a = d.adjustments.find((x) => x.id === p.adjustmentId)
      if (!a) return no('That adjustment no longer exists.')
      if (a.status !== 'proposed') return no(`Already ${a.status}.`)
      if (a.by === actor.id) return no('A person may not review their own work. Another reviewer or the partner must decide.')
      if (action.type === 'adjustment.approved' && magnitude(a.effect) > PARTNER_THRESHOLD && actor.role !== 'partner') {
        return no(`Estimated tax effect is over ${PARTNER_THRESHOLD.toLocaleString('en-US')}: firm standard requires the partner to approve.`)
      }
      return OK
    }

    case 'adjustment.proposed': {
      const p = action.payload as AdjustmentPayload
      if (!p.reason?.trim()) return no('Every adjustment needs a reason.')
      return OK
    }

    case 'finding.dismissed': {
      const p = action.payload as Payloads['finding.dismissed']
      if (!p.reason?.trim()) return no('Dismissing a finding needs a reason.')
      return OK
    }

    case 'decision.recorded': {
      const p = action.payload as Payloads['decision.recorded']
      if (!p.authority?.trim()) return no('Firm standard: every judgment call records the authority relied on.')
      return OK
    }

    case 'signoff.given': {
      const p = action.payload as Payloads['signoff.given']
      if (p.level !== actor.role) return no(`Sign-off at ${p.level} level is for the ${p.level}. ${actor.name} signs as ${ROLE_LABEL[actor.role].toLowerCase()}.`)
      const inScope = (lineKey: string) => p.scope === 'return' || areaOf(lineKey) === p.scope
      if (p.level !== 'preparer') {
        const ownWork = d.adjustments.some((a) => a.by === actor.id && inScope(a.lineKey)) ||
          d.signoffs.some((s) => s.scope === p.scope && s.level === 'preparer' && s.by === actor.id)
        if (ownWork) return no('A person may not review or sign off on work they prepared in this area.')
        const need = p.level === 'reviewer' ? 'preparer' : 'reviewer'
        const prior = d.signoffs.filter((s) => s.scope === p.scope && s.level === need)
        if (!prior.some((s) => s.hash === p.hash)) return no(`Needs a current ${need} sign-off on this area first.`)
      }
      const blocking = d.notes.filter((n) => n.blocking && !n.resolved && n.refs.some(inScope))
      if (blocking.length && p.level !== 'preparer') return no(`${blocking.length} open blocking review note${blocking.length > 1 ? 's' : ''} in this area.`)
      return OK
    }

    case 'note.resolved': {
      const p = action.payload as Payloads['note.resolved']
      const n = d.notes.find((x) => x.id === p.noteId)
      if (!n) return no('Note not found.')
      if (n.resolved) return no('Already resolved.')
      if (n.kind === 'review' && n.by !== actor.id && actor.role === 'preparer') return no('A review note is cleared by the reviewer who raised it (or the partner) after the preparer responds.')
      return OK
    }

    case 'event.reversed': {
      const p = action.payload as Payloads['event.reversed']
      const target = events.find((e) => e.id === p.eventId)
      if (!target) return no('Nothing to undo.')
      if (target.actor !== actor.id && actor.role !== 'partner') return no('Only the person who did it (or the partner) can undo it.')
      if (d.reversed.has(target.id)) return no('Already undone.')
      return OK
    }
  }
  return OK
}
