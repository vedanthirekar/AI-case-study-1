// Which per-dollar rate an adjustment to a line moves, and in which direction.
// The person adjusting can override it; this is the starting point.
import { areaOf } from '../lib/packet/areas'
import type { EffectBasis, EffectCategory } from '../lib/workpaper/events'

const SHORT = new Set(['A', 'B', 'C', 'G', 'H', 'I'])

export function defaultBasis(key: string, delta: number): { fed: EffectBasis; ca: EffectBasis } {
  const [form, ...rest] = key.split('.')
  const line = rest.join('.')
  const n = parseFloat(line)
  const both = (category: EffectCategory, amount: number) => ({ fed: { category, amount }, ca: { category, amount } })

  if (form === 'SchCA540NR' || form === 'F540NR' || form === 'ScheduleS' || form.startsWith('FTB')) {
    if (form === 'F540NR' && n >= 71 && n <= 78) return { fed: { category: 'none', amount: 0 }, ca: { category: 'payment', amount: delta } }
    return { fed: { category: 'none', amount: 0 }, ca: { category: 'ca_source_income', amount: delta } }
  }
  if (form === 'SchC') {
    if (n >= 8 && n <= 30 && !/^(28|29)$/.test(line)) return both('schc_profit', -delta) // an expense
    return both('schc_profit', delta)
  }
  if (form === 'SchE') {
    if (/^3/.test(line) || /^28/.test(line)) return both('ordinary_income', delta)
    if (/^(9|1[0-9]|20)/.test(line)) return both('ordinary_income', -delta)
    return both('ordinary_income', delta)
  }
  if (form === 'F8949') return both(SHORT.has(rest[0]) ? 'stcg' : 'ltcg', delta)
  if (form === 'SchB') return both('interest', delta)
  if (form === 'SchA' || form === 'F8283') return /^5/.test(line) ? { fed: { category: 'salt', amount: delta }, ca: { category: 'itemized', amount: delta } } : both('itemized', delta)
  if (form === 'Sch1' && n >= 11) return both('adjustment', delta)
  if (form === 'Sch3' && (n === 10 || n === 11)) return { fed: { category: 'payment', amount: delta }, ca: { category: 'none', amount: 0 } }
  if (form === 'F1040' && (/^25/.test(line) || n === 26 || n === 31)) return { fed: { category: 'payment', amount: delta }, ca: { category: 'none', amount: 0 } }
  if (form === 'F2441' || form === 'F8812' || form === 'F8863') return { fed: { category: 'credit', amount: delta }, ca: { category: 'none', amount: 0 } }

  switch (areaOf(key)) {
    case 'wages': return both('wages', delta)
    case 'investments': return both('interest', delta)
    case 'business': return both('schc_profit', delta)
    default: return both('ordinary_income', delta)
  }
}

export const CATEGORIES: EffectCategory[] = ['wages', 'interest', 'schc_profit', 'stcg', 'ltcg', 'ordinary_income', 'adjustment', 'salt', 'itemized', 'ca_source_income', 'payment', 'credit', 'none']
