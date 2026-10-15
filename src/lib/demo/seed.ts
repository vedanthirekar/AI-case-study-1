// "Load mid-season demo": a realistic week of review work, built as ordinary
// events (the same shapes the UI writes), so a first-time visitor sees the
// workpaper in motion: verifications, approved fixes, a sign-off, a blocking
// review note, an open client question, a logged reveal.
import type { Model } from '../packet/model'
import { runChecks } from '../checks/checks'
import { derive, scopeSnapshot, hashOf } from '../workpaper/derive'
import { newId, type EventType, type Payloads, type WPEvent } from '../workpaper/events'

export const SEED_SIM_NOW = '2026-06-26T17:00:00Z'

export function seedEvents(m: Model): WPEvent[] {
  const out: WPEvent[] = []
  let seq = Date.now() * 1000
  let t = Date.parse('2026-06-23T14:00:00Z')
  const add = <T extends EventType>(actor: string, type: T, refs: string[], payload: Payloads[T], batchId?: string) => {
    t += 47 * 60000
    const e = { id: newId(), seq: seq++, at: new Date().toISOString(), simAt: new Date(t).toISOString(), actor, type, refs, payload, batchId } as WPEvent
    out.push(e)
    return e
  }
  const findings = runChecks(m, { simNow: '2026-06-24T12:00:00Z' })
  const propose = (id: string) => {
    const f = findings.find((x) => x.id === id || x.id.startsWith(id))
    if (!f) return []
    const batch = f.proposals.length > 1 ? newId() : undefined
    return f.proposals.map((p) => add('st-01', 'adjustment.proposed', [p.lineKey, `finding:${f.id}`], { lineKey: p.lineKey, from: p.from, to: p.to, fed: p.fed, ca: p.ca, reason: p.reason, findingId: f.id }, batch))
  }

  // Priya works through wages and agrees the carryovers.
  add('st-01', 'time.logged', ['wages'], { area: 'wages', hours: 2.5, note: 'W-2s, stock plan statements' })
  for (const k of ['F1040.1a', 'F1040.25a', 'F8959.1']) add('st-01', 'verification.recorded', [k], { method: 'agreed_to_source_document', note: 'Agreed to both W-2s; the phone photo D10 is the same W-2 as D09.' })
  for (const k of ['SchD.6', 'SchD.14', 'F8606.2']) add('st-01', 'verification.recorded', [k], { method: 'agreed_to_prior_year', note: 'Agreed to the 2024 return and carryover worksheet (D06, D07).' })
  add('st-01', 'time.logged', ['investments'], { area: 'investments', hours: 3, note: 'Brokerage statements and crypto' })

  // Small mechanical fixes, approved by the reviewer (under the partner threshold).
  const small = [...propose('payoff-interest'), ...propose('duplicate-payer'), ...propose('fx-year')]

  // Priya signs off wages; Daniel reviews and signs.
  const wagesSnap = () => scopeSnapshot(m, derive(out, m), 'wages')
  { const s = wagesSnap(); add('st-01', 'signoff.given', ['scope:wages'], { scope: 'wages', level: 'preparer', hash: hashOf(s), snapshot: s }) }
  for (const a of small) add('st-02', 'adjustment.approved', [String((a.payload as Payloads['adjustment.proposed']).lineKey)], { adjustmentId: a.id })
  { const s = wagesSnap(); add('st-02', 'signoff.given', ['scope:wages'], { scope: 'wages', level: 'reviewer', hash: hashOf(s), snapshot: s }) }

  // Review notes and a question only the client can answer.
  add('st-02', 'note.created', ['SchE.14A'], { kind: 'review', blocking: true, text: 'The HVAC job replaced the whole system (heat pump, air handler, line set). That reads as an improvement to a building system under Treas. Reg. 1.263(a)-3, not a repair. Support repair treatment or capitalize it.' })
  add('st-02', 'note.created', ['SchC.30'], { kind: 'note', blocking: false, text: 'Home office down from 300 to 240 sq ft: the prior preparer combined two rooms. Client note D24 supports 220 then 260.' })
  const q = newId()
  add('st-01', 'thread.message', ['F8949.H.C6', `thread:${q}`], { threadId: q, to: 'client', text: 'Coinhaven shows 0.05 BTC transferred in on June 1, 2025 with no cost. Where and when did you buy it, and for how much? A bank or exchange statement would help.' })

  // Daniel checks an SSN against the card (logged), and hands California to Marcus.
  add('st-02', 'sensitive.revealed', ['doc:D08#page1'], { field: 'doc:D08#page1', label: '2025 Form W-2 - Corvane Systems, Inc. (Ngozi Okafor), page 1' })
  add('st-02', 'assignment.set', ['california'], { scope: 'california', assignee: 'st-04', due: '2026-07-01', note: 'Part-year split and the wage sourcing finding' })
  add('st-02', 'time.logged', ['partner_review'], { area: 'summary', hours: 1.5, note: 'First review pass' })
  return out
}
