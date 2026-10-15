// Projection: the event log folded into the state every screen reads.
// Pure function of (events, model); recomputed when the log changes.
import type { Model } from '../packet/model'
import { areaOf } from '../packet/areas'
import type { WPEvent, AdjustmentPayload, Payloads } from './events'
import { effectOf, addEffects, ZERO, type Effect } from './effect'

export interface Adjustment extends AdjustmentPayload {
  id: string
  by: string
  at: string
  simAt: string
  status: 'proposed' | 'approved' | 'rejected'
  decidedBy?: string
  decisionNote?: string
  effect: Effect
  area: string
  batchId?: string
}

export interface Verification { id: string; ref: string; by: string; at: string; simAt: string; method: string; note?: string; batchId?: string }
export interface Note { id: string; refs: string[]; by: string; at: string; text: string; blocking: boolean; kind: 'review' | 'note'; resolved?: { by: string; at: string; resolution: string } }
export interface Signoff { id: string; scope: string; level: 'preparer' | 'reviewer' | 'partner'; by: string; at: string; hash: string; snapshot: Record<string, string | number> }
export interface Dismissal { id: string; findingId: string; by: string; at: string; reason: string }

export interface Derived {
  /** events still in force (reversed ones and reversal markers removed) */
  live: WPEvent[]
  reversed: Set<string>
  verifications: Map<string, Verification[]>
  adjustments: Adjustment[]
  adjByLine: Map<string, Adjustment[]>
  dismissals: Map<string, Dismissal>
  notes: Note[]
  signoffs: Signoff[]
  decisions: (WPEvent<'decision.recorded'>)[]
  reveals: (WPEvent<'sensitive.revealed'>)[]
  /** total estimated effect of adjustments not rejected */
  totalEffect: Effect
}

export function derive(events: WPEvent[], m: Model): Derived {
  const reversed = new Set<string>()
  for (const e of events) if (e.type === 'event.reversed') reversed.add((e.payload as Payloads['event.reversed']).eventId)
  const live = events.filter((e) => e.type !== 'event.reversed' && !reversed.has(e.id))

  const rates = m.current.v.tax_effect_rates
  const verifications = new Map<string, Verification[]>()
  const adjById = new Map<string, Adjustment>()
  const dismissals = new Map<string, Dismissal>()
  const notes = new Map<string, Note>()
  const signoffs: Signoff[] = []
  const decisions: WPEvent<'decision.recorded'>[] = []
  const reveals: WPEvent<'sensitive.revealed'>[] = []

  for (const e of live) {
    switch (e.type) {
      case 'verification.recorded': {
        const p = e.payload as Payloads['verification.recorded']
        for (const r of e.refs) {
          const v: Verification = { id: e.id, ref: r, by: e.actor, at: e.at, simAt: e.simAt, method: p.method, note: p.note, batchId: e.batchId }
          verifications.set(r, [...(verifications.get(r) ?? []), v])
        }
        break
      }
      case 'adjustment.proposed': {
        const p = e.payload as AdjustmentPayload
        adjById.set(e.id, { ...p, id: e.id, by: e.actor, at: e.at, simAt: e.simAt, status: 'proposed', effect: effectOf(p, rates), area: areaOf(p.lineKey), batchId: e.batchId })
        break
      }
      case 'adjustment.approved':
      case 'adjustment.rejected': {
        const p = e.payload as Payloads['adjustment.approved']
        const a = adjById.get(p.adjustmentId)
        if (a) { a.status = e.type === 'adjustment.approved' ? 'approved' : 'rejected'; a.decidedBy = e.actor; a.decisionNote = p.note }
        break
      }
      case 'finding.dismissed': {
        const p = e.payload as Payloads['finding.dismissed']
        dismissals.set(p.findingId, { id: e.id, findingId: p.findingId, by: e.actor, at: e.at, reason: p.reason })
        break
      }
      case 'note.created': {
        const p = e.payload as Payloads['note.created']
        notes.set(e.id, { id: e.id, refs: e.refs, by: e.actor, at: e.at, text: p.text, blocking: p.blocking, kind: p.kind })
        break
      }
      case 'note.resolved': {
        const p = e.payload as Payloads['note.resolved']
        const n = notes.get(p.noteId)
        if (n) n.resolved = { by: e.actor, at: e.at, resolution: p.resolution }
        break
      }
      case 'signoff.given': {
        const p = e.payload as Payloads['signoff.given']
        signoffs.push({ id: e.id, scope: p.scope, level: p.level, by: e.actor, at: e.at, hash: p.hash, snapshot: p.snapshot })
        break
      }
      case 'decision.recorded': decisions.push(e as WPEvent<'decision.recorded'>); break
      case 'sensitive.revealed': reveals.push(e as WPEvent<'sensitive.revealed'>); break
    }
  }

  const adjustments = [...adjById.values()]
  const adjByLine = new Map<string, Adjustment[]>()
  let totalEffect = ZERO
  for (const a of adjustments) {
    adjByLine.set(a.lineKey, [...(adjByLine.get(a.lineKey) ?? []), a])
    if (a.status !== 'rejected') totalEffect = addEffects(totalEffect, a.effect)
  }

  return {
    live, reversed, verifications, adjustments, adjByLine, dismissals,
    notes: [...notes.values()], signoffs, decisions, reveals, totalEffect,
  }
}

/** The value a line shows after adjustments that were not rejected (latest wins). */
export function effectiveValue(m: Model, d: Derived, key: string): { value: number | string | null; original: number | string | null; adjusted: Adjustment | null } {
  const line = m.current.lines.get(key)
  const original = line ? line.value : null
  const adj = (d.adjByLine.get(key) ?? []).filter((a) => a.status !== 'rejected')
  const last = adj[adj.length - 1] ?? null
  return { value: last ? last.to : original, original, adjusted: last }
}

/** Small stable hash (FNV-1a) used to fingerprint what a sign-off covered. */
export function hashOf(obj: unknown): string {
  const s = JSON.stringify(obj)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** Everything a sign-off on an area covers: effective values, adjustments, verifications, open notes. */
export function scopeSnapshot(m: Model, d: Derived, scope: string): Record<string, string | number> {
  const snap: Record<string, string | number> = {}
  const keys = scope === 'return' ? m.current.order : m.current.order.filter((k) => areaOf(k) === scope)
  for (const k of keys) {
    const ev = effectiveValue(m, d, k)
    snap[k] = ev.value ?? ''
  }
  for (const a of d.adjustments) if (scope === 'return' || a.area === scope) snap[`adj:${a.id}`] = a.status
  for (const n of d.notes) if (!n.resolved && n.blocking && (scope === 'return' || n.refs.some((r) => areaOf(r) === scope))) snap[`note:${n.id}`] = 'open'
  return snap
}

/** Keys whose values differ between a signed snapshot and now. */
export function snapshotDiff(signed: Record<string, string | number>, now: Record<string, string | number>): string[] {
  const keys = new Set([...Object.keys(signed), ...Object.keys(now)])
  return [...keys].filter((k) => signed[k] !== now[k])
}
