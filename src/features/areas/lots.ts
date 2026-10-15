// Form 8949 sales, read from each lot's source values. Brokers name fields
// differently (acquired / acq, description / desc / asset), so match by suffix.
import type { Model } from '../../lib/packet/model'
import type { ExtractedValue, Line } from '../../lib/packet/types'

export interface Lot {
  key: string; id: string; box: string; term: 'short' | 'long'
  broker: string; docId: string | null
  description: string; acquired: string | null; sold: string | null
  proceeds: number | null; basis: number | null; wash: number
  gain: number; basisMissing: boolean; adjusted: boolean
}

const SHORT = new Set(['A', 'B', 'C', 'G', 'H', 'I'])
const pick = (evs: ExtractedValue[], re: RegExp) => evs.find((e) => re.test(e.field))

export function lotOf(m: Model, l: Line): Lot {
  const evs = l.sources.map((s) => m.evs.get(s)).filter((e): e is ExtractedValue => !!e)
  const [, box, id] = l.key.split('.')
  const doc = evs[0] ? m.docs.get(evs[0].document_id) : undefined
  const num = (e?: ExtractedValue) => (e && typeof e.value === 'number' ? e.value : null)
  const str = (e?: ExtractedValue) => (e && e.value != null ? String(e.value) : null)
  // Crypto lots take proceeds from the 1099-DA and basis from the exchange export.
  const basisEv = pick(evs, /_basis$/)
  return {
    key: l.key, id, box, term: SHORT.has(box) ? 'short' : 'long',
    broker: doc ? (doc.issuer || doc.title) : l.label.split(' - ')[0],
    docId: doc?.id ?? null,
    description: str(pick(evs, /_(description|desc|asset)$/)) ?? l.label.replace(/\s*\(.*$/, ''),
    acquired: str(pick(evs, /_(acquired|acq)$/)),
    sold: str(pick(evs, /_sold$/)),
    proceeds: num(pick(evs, /_proceeds$/)),
    basis: num(basisEv),
    wash: num(pick(evs, /_wash$/)) ?? 0,
    gain: typeof l.value === 'number' ? l.value : 0,
    basisMissing: !!basisEv && (basisEv.value === null || basisEv.value === 0),
    adjusted: /adjustment/i.test(l.label),
  }
}

export function allLots(m: Model): Lot[] {
  return m.current.v.lines.filter((l) => l.form === 'F8949' && !/total$/.test(l.key)).map((l) => lotOf(m, l))
}
