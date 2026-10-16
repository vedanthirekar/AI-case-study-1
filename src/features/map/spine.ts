// The return map: the return's spine, from income to amount owed, as ~20 nodes
// instead of 600 lines. Each node is a real return line (so it zooms into that
// line's lineage), and every finding is attached to the spine node its lines
// flow into, so problems show where they land on the return.
import type { Model } from '../../lib/packet/model'
import { num } from '../../lib/packet/model'
import type { Derived } from '../../lib/workpaper/derive'
import { effectiveValue } from '../../lib/workpaper/derive'
import { magnitude } from '../../lib/workpaper/effect'
import type { ReviewedFinding } from '../findings'

export interface SpineNode {
  id: string
  key: string
  label: string
  /** feeds these spine nodes */
  to: string[]
  jurisdiction: 'federal' | 'california'
  /** estimated total after adjustments, for the bottom-line nodes */
  estimate?: 'fedTax' | 'fedBalance' | 'caTax' | 'caBalance'
  /** fallback when a finding has no lines */
  areas?: string[]
}

export const SPINE: SpineNode[] = [
  { id: 'wages', key: 'F1040.1z', label: 'Wages', to: ['agi'], jurisdiction: 'federal', areas: ['wages'] },
  { id: 'interest', key: 'F1040.2b', label: 'Interest', to: ['agi'], jurisdiction: 'federal' },
  { id: 'dividends', key: 'F1040.3b', label: 'Dividends', to: ['agi'], jurisdiction: 'federal' },
  { id: 'gains', key: 'F1040.7', label: 'Capital gains', to: ['agi'], jurisdiction: 'federal', areas: ['investments'] },
  { id: 'ira', key: 'F1040.4b', label: 'IRA (Roth conversion)', to: ['agi'], jurisdiction: 'federal', areas: ['retirement'] },
  { id: 'business', key: 'Sch1.3', label: 'Business (Schedule C)', to: ['agi'], jurisdiction: 'federal', areas: ['business'] },
  { id: 'rentals', key: 'Sch1.5', label: 'Rentals and K-1s', to: ['agi'], jurisdiction: 'federal', areas: ['rentals', 'passthroughs'] },
  { id: 'adjustments', key: 'F1040.10', label: 'Adjustments (SE tax, SEP, health)', to: ['agi'], jurisdiction: 'federal' },
  { id: 'agi', key: 'F1040.11', label: 'Adjusted gross income', to: ['taxable', 'ca_agi'], jurisdiction: 'federal', areas: ['summary'] },
  { id: 'deductions', key: 'F1040.12', label: 'Itemized deductions', to: ['taxable'], jurisdiction: 'federal', areas: ['deductions'] },
  { id: 'qbi', key: 'F1040.13', label: 'QBI deduction', to: ['taxable'], jurisdiction: 'federal' },
  { id: 'taxable', key: 'F1040.15', label: 'Taxable income', to: ['tax'], jurisdiction: 'federal' },
  { id: 'tax', key: 'F1040.16', label: 'Regular tax', to: ['total_tax'], jurisdiction: 'federal' },
  { id: 'amt', key: 'F1040.17', label: 'AMT (stock options)', to: ['total_tax'], jurisdiction: 'federal' },
  { id: 'credits', key: 'F1040.19', label: 'Child and other credits', to: ['total_tax'], jurisdiction: 'federal' },
  { id: 'other_tax', key: 'F1040.23', label: 'SE tax, NIIT, Medicare', to: ['total_tax'], jurisdiction: 'federal' },
  { id: 'total_tax', key: 'F1040.24', label: 'Total tax', to: ['owed'], jurisdiction: 'federal', estimate: 'fedTax' },
  { id: 'payments', key: 'F1040.33', label: 'Payments', to: ['owed'], jurisdiction: 'federal', areas: ['payments'] },
  { id: 'owed', key: 'F1040.37', label: 'Amount owed', to: [], jurisdiction: 'federal', estimate: 'fedBalance' },
  { id: 'ca_agi', key: 'F540NR.32', label: 'California AGI (part-year)', to: ['ca_tax'], jurisdiction: 'california', areas: ['california'] },
  { id: 'ca_tax', key: 'F540NR.64', label: 'California tax', to: ['ca_owed'], jurisdiction: 'california', estimate: 'caTax' },
  { id: 'ca_payments', key: 'F540NR.78', label: 'California payments', to: ['ca_owed'], jurisdiction: 'california' },
  { id: 'ca_owed', key: 'F540NR.97', label: 'California refund', to: [], jurisdiction: 'california', estimate: 'caBalance' },
]

const BY_KEY = new Map(SPINE.map((n) => [n.key, n.id]))

const JUR = new Map(SPINE.map((n) => [n.id, n.jurisdiction]))
const ORDER = new Map(SPINE.map((n, i) => [n.id, i]))

/**
 * Where a finding lands: of the spine nodes its lines flow into, the one earliest
 * on the return (income before tax), so a capital-gains problem lands on Capital
 * gains rather than on every total it later reaches; plus the earliest California
 * node when it moves California tax.
 */
export function landingNodes(m: Model, f: ReviewedFinding): string[] {
  let fed: [string, number] | null = null
  let ca: [string, number] | null = null
  for (const start of f.lines) {
    const seen = new Set<string>()
    const queue: string[] = [start]
    while (queue.length) {
      const k = queue.shift()!
      if (seen.has(k) || seen.size > 400) continue
      seen.add(k)
      const id = BY_KEY.get(k)
      if (id) {
        const at = ORDER.get(id)!
        if (JUR.get(id) === 'federal' && (!fed || at < fed[1])) fed = [id, at]
        if (JUR.get(id) === 'california' && (!ca || at < ca[1])) ca = [id, at]
        continue
      }
      queue.push(...(m.current.usedBy.get(k) ?? []))
    }
    // A line an adjustment adds (e.g. an unread sale) has no links yet: land by its form.
    if (!m.current.lines.has(start) && start.startsWith('F8949') && !fed) fed = ['gains', 0]
  }
  const movesCa = Math.abs(f.effect.caTax) >= 1 || Math.abs(f.effect.caBalance) >= 1 || f.area === 'california'
  const out: string[] = []
  if (fed && !(f.area === 'california' && ca)) out.push(fed[0])
  if (ca && movesCa) out.push(ca[0])
  if (!out.length) for (const n of SPINE) if (n.areas?.includes(f.area)) { out.push(n.id); break }
  return out
}

export interface SpineStat { value: number | string | null; estimate?: number; open: ReviewedFinding[]; atRisk: number; worst: 'error' | 'warning' | 'judgment' | 'info' | null; adjusted: number }

export function spineStats(m: Model, d: Derived, findings: ReviewedFinding[]) {
  const open = findings.filter((f) => f.status === 'open')
  const landing = new Map(open.map((f) => [f.id, landingNodes(m, f)]))
  const sum = m.current.v.summary
  const e = d.totalEffect
  const est = { fedTax: sum.federal.total_tax + e.fedTax, fedBalance: sum.federal.balance_due + e.fedBalance, caTax: sum.california.total_tax + e.caTax, caBalance: sum.california.balance_due + e.caBalance }
  const rank = { error: 3, warning: 2, judgment: 1, info: 0 }
  const stats = new Map<string, SpineStat>()
  for (const n of SPINE) {
    const here = open.filter((f) => landing.get(f.id)!.includes(n.id))
    const worst = here.reduce<SpineStat['worst']>((w, f) => (!w || rank[f.severity] > rank[w] ? f.severity : w), null)
    const adjusted = d.adjustments.filter((a) => a.status !== 'rejected' && a.lineKey === n.key).length
    stats.set(n.id, {
      value: effectiveValue(m, d, n.key).value,
      estimate: n.estimate ? Math.round(est[n.estimate]) : undefined,
      open: here, atRisk: here.reduce((s, f) => s + magnitude(f.effect), 0), worst, adjusted,
    })
  }
  return { stats, landing }
}

export const isNumber = (v: unknown): v is number => typeof v === 'number'
export { num }
