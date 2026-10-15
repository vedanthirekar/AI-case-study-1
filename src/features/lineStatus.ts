import type { Derived } from '../lib/workpaper/derive'
import type { ReviewedFinding } from './findings'

export type LineState = 'unverified' | 'verified' | 'adjusted' | 'flagged' | 'blocking'

/** Worst state wins: blocking > flagged > adjusted > verified > unverified. */
export function lineState(key: string, d: Derived, byLine: Map<string, ReviewedFinding[]>): LineState {
  if (d.notes.some((n) => n.blocking && !n.resolved && n.refs.includes(key))) return 'blocking'
  if (byLine.get(key)?.length) return 'flagged'
  if ((d.adjByLine.get(key) ?? []).some((a) => a.status !== 'rejected')) return 'adjusted'
  if (d.verifications.get(key)?.length) return 'verified'
  return 'unverified'
}
