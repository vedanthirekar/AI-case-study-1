// The workpaper is an append-only log of these events, layered over the
// untouched packet. Nothing is edited in place: undo is a reversing event.

export type EventType =
  | 'verification.recorded'
  | 'adjustment.proposed'
  | 'adjustment.approved'
  | 'adjustment.rejected'
  | 'finding.dismissed'
  | 'note.created'
  | 'note.resolved'
  | 'thread.message'
  | 'decision.recorded'
  | 'signoff.given'
  | 'sensitive.revealed'
  | 'attachment.added'
  | 'event.reversed'

/** Rate categories from return_versions[].tax_effect_rates, plus payments and none. */
export type EffectCategory =
  | 'wages' | 'interest' | 'schc_profit' | 'stcg' | 'ltcg' | 'ordinary_income' | 'adjustment'
  | 'salt' | 'itemized' | 'ca_source_income' | 'payment' | 'credit' | 'none'

export interface EffectBasis { category: EffectCategory; amount: number }

export interface AdjustmentPayload {
  lineKey: string
  from: number | string | null
  to: number | string
  /** the dollars that move federal tax, and how (defaults to the line delta) */
  fed: EffectBasis
  /** the dollars that move California tax, and how */
  ca: EffectBasis
  reason: string
  findingId?: string
}

export interface Payloads {
  'verification.recorded': { method: string; note?: string }
  'adjustment.proposed': AdjustmentPayload
  'adjustment.approved': { adjustmentId: string; note?: string }
  'adjustment.rejected': { adjustmentId: string; note: string }
  'finding.dismissed': { findingId: string; reason: string }
  'note.created': { text: string; blocking: boolean; kind: 'review' | 'note' }
  'note.resolved': { noteId: string; resolution: string }
  'thread.message': { threadId: string; to: 'client' | 'staff'; text: string }
  'decision.recorded': { kind: 'judgment' | 'election' | 'due_diligence' | 'penalty'; topic: string; choice: string; authority: string; rationale?: string }
  'signoff.given': { scope: string; level: 'preparer' | 'reviewer' | 'partner'; hash: string; snapshot: Record<string, string | number> }
  'sensitive.revealed': { field: string; label: string }
  'attachment.added': { name: string; size: number; mime: string; blobId: string }
  'event.reversed': { eventId: string; reason?: string }
}

export interface WPEvent<T extends EventType = EventType> {
  id: string
  /** local order of arrival */
  seq: number
  /** real wall-clock time of the action */
  at: string
  /** season-clock time the action was taken at */
  simAt: string
  actor: string
  type: T
  /** what the event is about (line keys, ev ids, document ids, finding ids...) */
  refs: string[]
  payload: Payloads[T]
  batchId?: string
}

/** What a caller asks for; the store stamps id, seq, times and actor. */
export interface Action<T extends EventType = EventType> {
  type: T
  refs: string[]
  payload: Payloads[T]
}

export const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `e-${Date.now()}-${Math.random().toString(36).slice(2)}`
