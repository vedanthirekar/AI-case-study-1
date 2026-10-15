// Firm standards in force: the packet's starter standards with every change the
// firm administrator has made on top (each change is an event, so history is kept).
import type { Model } from '../packet/model'
import type { WPEvent, Payloads } from './events'

export interface Standards {
  verification_types: string[]
  variance_review: { compare_to: string; flag_if_change_over_percent: number; and_over_amount: number }
  review_levels: string[]
  rules: string[]
  required_steps: string[]
  /** numeric form of "any adjustment with a tax effect over 1,000 requires partner sign-off" */
  partner_threshold: number
}

export function standardsOf(m: Model, live: WPEvent[]): Standards {
  const s = m.packet.firm.starter_standards
  const out: Standards = {
    verification_types: [...s.verification_types],
    variance_review: { ...s.variance_review },
    review_levels: [...s.review_levels],
    rules: [...s.rules],
    required_steps: [...s.required_steps],
    partner_threshold: Number(s.rules.join(' ').match(/tax effect over ([\d,]+)/)?.[1]?.replace(/,/g, '') ?? 1000),
  }
  for (const e of live) {
    if (e.type !== 'standard.changed') continue
    const p = e.payload as Payloads['standard.changed']
    const [head, tail] = p.path.split('.')
    if (tail) (out as unknown as Record<string, Record<string, unknown>>)[head][tail] = p.value
    else (out as unknown as Record<string, unknown>)[head] = p.value
  }
  return out
}
