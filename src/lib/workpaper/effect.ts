// Tax effect of an adjustment. The engine cannot be rerun, so the effect is
// the moved dollars times the per-dollar rates the engine measured at this
// version. Always presented as an estimate.
import type { Rate } from '../packet/types'
import type { AdjustmentPayload, EffectBasis } from './events'

export interface Effect {
  /** change in federal total tax */
  fedTax: number
  /** change in California total tax */
  caTax: number
  /** change in federal balance due (tax change minus payment change) */
  fedBalance: number
  /** change in California balance due */
  caBalance: number
}

export const ZERO: Effect = { fedTax: 0, caTax: 0, fedBalance: 0, caBalance: 0 }

function part(b: EffectBasis, rates: Record<string, Rate>, side: 'federal_per_dollar' | 'california_per_dollar') {
  if (b.category === 'none' || !b.amount) return { tax: 0, balance: 0 }
  if (b.category === 'payment') return { tax: 0, balance: -b.amount }
  if (b.category === 'credit') return { tax: -b.amount, balance: -b.amount }
  const r = rates[b.category]?.[side] ?? 0
  const tax = b.amount * r
  return { tax, balance: tax }
}

export function effectOf(p: Pick<AdjustmentPayload, 'fed' | 'ca'>, rates: Record<string, Rate>): Effect {
  const f = part(p.fed, rates, 'federal_per_dollar')
  const c = part(p.ca, rates, 'california_per_dollar')
  return { fedTax: f.tax, caTax: c.tax, fedBalance: f.balance, caBalance: c.balance }
}

export function addEffects(a: Effect, b: Effect): Effect {
  return { fedTax: a.fedTax + b.fedTax, caTax: a.caTax + b.caTax, fedBalance: a.fedBalance + b.fedBalance, caBalance: a.caBalance + b.caBalance }
}

/** Largest absolute tax or balance movement, used for ranking and the partner threshold. */
export function magnitude(e: Effect): number {
  return Math.max(Math.abs(e.fedTax), Math.abs(e.caTax), Math.abs(e.fedBalance), Math.abs(e.caBalance))
}

export const CATEGORY_LABEL: Record<string, string> = {
  wages: 'Wages', interest: 'Interest and dividends', schc_profit: 'Schedule C profit', stcg: 'Short-term gain',
  ltcg: 'Long-term gain', ordinary_income: 'Other ordinary income', adjustment: 'Adjustment to income',
  salt: 'State and local tax (capped)', itemized: 'Itemized deduction', ca_source_income: 'California-source income',
  payment: 'Payment', credit: 'Credit', none: 'No tax effect',
}
