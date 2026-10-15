// Formatting helpers. Always en-US: the dev machine's locale groups digits differently.

export const fmtNum = (n: number, digits = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const fmtMoney = (n: number, digits = 0) => `${n < 0 ? '-' : ''}$${fmtNum(Math.abs(n), digits)}`

export const fmtSigned = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}$${fmtNum(Math.abs(Math.round(n)))}`

/** A line or extracted value for display: numbers grouped, everything else as text. */
export function fmtValue(v: unknown): string {
  if (v == null || v === '') return '-'
  if (typeof v === 'number') return Number.isInteger(v) ? fmtNum(v) : fmtNum(v, Math.abs(v) < 1 ? 4 : 2)
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

export const fmtDate = (iso: string) => {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'

export const pct = (n: number) => `${Math.round(n * 100)}%`

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase()
}
