import type { EffectBasis } from '../workpaper/events'
import type { Effect } from '../workpaper/effect'

export type Severity = 'error' | 'warning' | 'judgment' | 'info'
export type FindingSource = 'check' | 'engine' | 'prior_preparer' | 'what_if'

export interface Proposal {
  lineKey: string
  from: number | string | null
  to: number | string
  fed: EffectBasis
  ca: EffectBasis
  reason: string
}

export interface Finding {
  /** stable across reloads, so dismissals and adjustments attach to it */
  id: string
  /** which check produced it (named in the errors write-up) */
  check: string
  title: string
  area: string
  severity: Severity
  source: FindingSource
  /** one or two sentences: what is wrong and why we think so */
  summary: string
  /** refs that prove it: documents, values, answers, agency records */
  evidence: string[]
  /** return lines it touches */
  lines: string[]
  proposals: Proposal[]
  /** estimated effect if every proposal is accepted */
  effect: Effect
  /** something that must be resolved before filing even without a tax effect */
  blocksFiling?: boolean
  /** what someone should do next when there is no proposal */
  nextStep?: string
  /** engine diagnostic codes this finding explains */
  covers?: string[]
}

export interface CheckContext {
  simNow: string
}
