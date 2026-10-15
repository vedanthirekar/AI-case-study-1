// Review areas: how the return is divided for work, budgets and sign-off.
// Mirrors the firm's budget areas, plus summary, payments and retirement/foreign.

export interface Area { id: string; label: string; budgetKey?: string; icon: string }

export const AREAS: Area[] = [
  { id: 'summary', label: 'Return summary and tax', budgetKey: 'partner_review', icon: 'scale' },
  { id: 'wages', label: 'Wages and stock compensation', budgetKey: 'wages_and_stock_compensation', icon: 'users' },
  { id: 'investments', label: 'Investments and digital assets', budgetKey: 'investments_and_digital_assets', icon: 'trending' },
  { id: 'business', label: 'Business (Schedule C)', budgetKey: 'business', icon: 'folder' },
  { id: 'rentals', label: 'Rentals and sale', budgetKey: 'rentals_and_sale', icon: 'home' },
  { id: 'passthroughs', label: 'Pass-throughs and basis', budgetKey: 'pass_throughs_and_basis', icon: 'link' },
  { id: 'retirement', label: 'Retirement and foreign', icon: 'globe' },
  { id: 'deductions', label: 'Deductions and credits', budgetKey: 'deductions_and_credits', icon: 'check-double' },
  { id: 'payments', label: 'Payments', budgetKey: 'intake_and_engagement', icon: 'send' },
  { id: 'california', label: 'California (part-year)', budgetKey: 'california', icon: 'globe' },
]

export const AREA_BY_ID = new Map(AREAS.map((a) => [a.id, a]))

const BY_FORM: Record<string, string> = {
  F8959: 'wages', F8889: 'wages',
  SchB: 'investments', SchD: 'investments', F8949: 'investments', F8960: 'investments',
  F8606: 'retirement', F8938: 'retirement',
  SchC: 'business', SchSE: 'business', 'F4562-C': 'business', F8995: 'business',
  'F4562-E': 'rentals', F4797: 'rentals', F8582: 'rentals',
  F7203: 'passthroughs',
  SchA: 'deductions', F8283: 'deductions', F8812: 'deductions', F8863: 'deductions', F2441: 'deductions', F8867: 'deductions',
  SchCA540NR: 'california', F540NR: 'california', ScheduleS: 'california', FTB3885A: 'california', FTB5805: 'california',
  F1040: 'summary', Sch1: 'summary', Sch2: 'summary', Sch3: 'deductions', F6251: 'summary', F2210: 'payments',
}

const BY_KEY: Record<string, string> = {
  'F1040.1a': 'wages', 'F1040.1z': 'wages', 'F6251.2i': 'wages',
  'F1040.2b': 'investments', 'F1040.3a': 'investments', 'F1040.3b': 'investments', 'F1040.7': 'investments',
  'F1040.4a': 'retirement', 'F1040.4b': 'retirement',
  'F1040.25a': 'payments', 'F1040.25d': 'payments', 'F1040.26': 'payments', 'F1040.31': 'payments', 'F1040.33': 'payments',
  'F1040.37': 'payments', 'F1040.38': 'payments',
  'Sch3.10': 'payments', 'Sch3.11': 'payments', 'Sch3.15': 'payments',
  'Sch1.3': 'business', 'Sch1.15': 'business', 'Sch1.16': 'business', 'Sch1.17': 'business',
  'Sch1.5': 'rentals', 'Sch1.13': 'wages',
}

export function areaOf(key: string): string {
  if (BY_KEY[key]) return BY_KEY[key]
  const form = key.split('.')[0]
  if (form === 'SchE') {
    const rest = key.slice(5)
    return /^(28|32)/.test(rest) ? 'passthroughs' : 'rentals'
  }
  return BY_FORM[form] ?? 'summary'
}
