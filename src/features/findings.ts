// Findings from the independent checks, joined with what people have done about them.
import { useMemo } from 'react'
import { runChecks } from '../lib/checks/checks'
import type { Finding } from '../lib/checks/types'
import { magnitude, netChange } from '../lib/workpaper/effect'
import type { Derived } from '../lib/workpaper/derive'
import { useApp, useDerived, useModel } from '../state/app'

export type FindingStatus = 'open' | 'proposed' | 'resolved' | 'dismissed'

export interface ReviewedFinding extends Finding {
  status: FindingStatus
  /** adjustments made from this finding */
  adjustmentIds: string[]
  rank: number
}

const SEV_RANK = { error: 3, warning: 2, judgment: 1, info: 0 }

export function statusOf(f: Finding, d: Derived): { status: FindingStatus; adjustmentIds: string[] } {
  if (d.dismissals.has(f.id)) return { status: 'dismissed', adjustmentIds: [] }
  const adj = d.adjustments.filter((a) => a.findingId === f.id && a.status !== 'rejected')
  if (adj.length) return { status: adj.every((a) => a.status === 'approved') ? 'resolved' : 'proposed', adjustmentIds: adj.map((a) => a.id) }
  if (d.decisions.some((e) => e.payload.topic === f.id)) return { status: 'resolved', adjustmentIds: [] }
  if (d.verifications.has(`finding:${f.id}`)) return { status: 'resolved', adjustmentIds: [] }
  return { status: 'open', adjustmentIds: [] }
}

/** All findings for the current season-clock date, ranked by tax at risk. */
export function useFindings(): ReviewedFinding[] {
  const model = useModel()
  const simNow = useApp((s) => s.simNow)
  const d = useDerived()
  const raw = useMemo(() => runChecks(model, { simNow }), [model, simNow])
  return useMemo(() => raw.map((f) => {
    const s = statusOf(f, d)
    return { ...f, ...s, rank: magnitude(f.effect) * 10 + SEV_RANK[f.severity] }
  }).sort((a, b) => b.rank - a.rank), [raw, d])
}

/** An open issue: still needs action. Informational notes (severity info) are listed in Review but not counted. */
export const isOpenIssue = (f: { status: FindingStatus; severity: string }) => f.status === 'open' && f.severity !== 'info'

/** Dollars an issue puts at stake: what the household would owe differently if it is fixed. Judgment
 * calls are alternatives to the engine's (cheaper) choice, so nothing is at stake until one is chosen. */
export const atStake = (f: Finding) => (f.severity === 'judgment' ? 0 : Math.abs(netChange(f.effect)))

/** Documents that findings cite as evidence (directly, by page, or through a value read from them). */
export function evidenceDocs(fs: Finding[], evDoc: (id: string) => string | undefined): Set<string> {
  const s = new Set<string>()
  for (const f of fs) for (const e of f.evidence) {
    const doc = /^D\d{2}$/.test(e) ? e : e.match(/^doc:(D\d{2})#/)?.[1] ?? evDoc(e)
    if (doc) s.add(doc)
  }
  return s
}

/** Open findings that touch each line, for line status. */
export function findingsByLine(fs: ReviewedFinding[]): Map<string, ReviewedFinding[]> {
  const m = new Map<string, ReviewedFinding[]>()
  for (const f of fs) {
    if (f.status !== 'open') continue
    for (const k of f.lines) m.set(k, [...(m.get(k) ?? []), f])
  }
  return m
}
