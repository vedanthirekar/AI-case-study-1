// Normalizes the packet into lookup indexes. Built once per session; read-only.
// Every screen reads through this model, never through raw arrays.
import type { Packet, Doc, ExtractedValue, Line, ReturnVersion, Asset, Person, Staff, QA, Message, CallNote, TimelineEvent } from './types'

export interface VersionIndex {
  v: ReturnVersion
  lines: Map<string, Line>
  order: string[]
  /** line key -> keys of lines that use it as an input */
  usedBy: Map<string, string[]>
  /** extracted value id -> line keys that cite it as a source */
  linesByEv: Map<string, string[]>
  /** document id -> line keys fed by any of its values */
  linesByDoc: Map<string, string[]>
  assets: Map<string, Asset>
}

export interface Model {
  packet: Packet
  docs: Map<string, Doc>
  evs: Map<string, ExtractedValue>
  evsByDoc: Map<string, ExtractedValue[]>
  versions: Map<string, VersionIndex>
  versionOrder: string[]
  current: VersionIndex
  people: Map<string, Person>
  staff: Map<string, Staff>
  qa: Map<string, QA>
  messages: Map<string, Message>
  calls: Map<string, CallNote>
  timeline: TimelineEvent[]
  taxYear: number
  /** last day of California residency (part-year state split) */
  caResidencyEnd: string
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const a = m.get(k)
  if (a) { if (!a.includes(v)) a.push(v) } else m.set(k, [v])
}

function indexVersion(v: ReturnVersion, evs: Map<string, ExtractedValue>): VersionIndex {
  const lines = new Map<string, Line>()
  const usedBy = new Map<string, string[]>()
  const linesByEv = new Map<string, string[]>()
  const linesByDoc = new Map<string, string[]>()
  for (const l of v.lines) {
    lines.set(l.key, l)
    for (const i of l.inputs) push(usedBy, i, l.key)
    for (const s of l.sources) {
      const ev = evs.get(s)
      if (ev) { push(linesByEv, s, l.key); push(linesByDoc, ev.document_id, l.key) }
    }
  }
  return {
    v, lines, order: v.lines.map((l) => l.key), usedBy, linesByEv, linesByDoc,
    assets: new Map(v.assets.map((a) => [a.asset_id, a])),
  }
}

export function buildModel(packet: Packet): Model {
  const docs = new Map(packet.documents.map((d) => [d.id, d]))
  const evs = new Map(packet.extracted_values.map((e) => [e.id, e]))
  const evsByDoc = new Map<string, ExtractedValue[]>()
  for (const e of packet.extracted_values) push(evsByDoc, e.document_id, e)

  const versions = new Map<string, VersionIndex>()
  for (const v of packet.return_versions) versions.set(v.version, indexVersion(v, evs))
  const versionOrder = packet.return_versions.map((v) => v.version)

  const ca = packet.household.residency.find((r) => r.state === 'CA')
  return {
    packet, docs, evs, evsByDoc, versions, versionOrder,
    current: versions.get(versionOrder[versionOrder.length - 1])!,
    people: new Map(packet.household.people.map((p) => [p.id, p])),
    staff: new Map(packet.firm.staff.map((s) => [s.id, s])),
    qa: new Map(packet.client.questionnaire.map((q) => [q.id, q])),
    messages: new Map(packet.client.messages.map((m) => [m.id, m])),
    calls: new Map(packet.client.call_notes.map((c) => [c.id, c])),
    timeline: packet.timeline,
    taxYear: packet.household.tax_year,
    caResidencyEnd: ca?.to ?? `${packet.household.tax_year}-12-31`,
  }
}

/** Numeric value of a line, or 0 for text lines. */
export function num(l: Line | undefined): number {
  return l && typeof l.value === 'number' ? l.value : 0
}

/** The extracted value on a document by field name. */
export function evByField(m: Model, docId: string, field: string): ExtractedValue | undefined {
  return m.evsByDoc.get(docId)?.find((e) => e.field === field)
}

/** Documents of a type, in id order. */
export function docsOfType(m: Model, type: string): Doc[] {
  return m.packet.documents.filter((d) => d.document_type === type)
}

/** Resolve an RFC 6901 JSON Pointer against an object. */
export function getPointer(root: unknown, pointer: string): unknown {
  if (pointer === '' || pointer === '/') return root
  let cur: unknown = root
  for (const raw of pointer.replace(/^\//, '').split('/')) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~')
    if (cur == null) return undefined
    cur = Array.isArray(cur) ? cur[Number(key)] : (cur as Record<string, unknown>)[key]
  }
  return cur
}
