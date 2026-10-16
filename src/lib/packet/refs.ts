// One parser and resolver for every reference format in the packet readme.
// Every link in the app goes through here, so a reference always renders the
// same way and always knows where it points.
import type { Model } from './model'
import { getPointer } from './model'
import { C } from '../paths'

export type RefKind =
  | 'line' | 'ev' | 'doc' | 'docPage' | 'qa' | 'msg' | 'call' | 'py' | 'agency'
  | 'asset' | 'household' | 'param' | 'fx' | 'timeline' | 'version' | 'unknown'

export interface Ref { raw: string; kind: RefKind; id: string; page?: number; pointer?: string }

export function parseRef(raw: string): Ref {
  const s = raw.trim()
  let m: RegExpMatchArray | null
  if (/^ev-\d+$/.test(s)) return { raw, kind: 'ev', id: s }
  if (/^D\d{2}$/.test(s)) return { raw, kind: 'doc', id: s }
  if ((m = s.match(/^doc:(D\d{2})#page(\d+)$/))) return { raw, kind: 'docPage', id: m[1], page: Number(m[2]) }
  if (/^qa-\d+$/.test(s)) return { raw, kind: 'qa', id: s }
  if (/^msg-\d+$/.test(s)) return { raw, kind: 'msg', id: s }
  if (/^call-\d+$/.test(s)) return { raw, kind: 'call', id: s }
  if (s.startsWith('py:')) return { raw, kind: 'py', id: s, pointer: s.slice(3) }
  if (s.startsWith('agency:')) return { raw, kind: 'agency', id: s, pointer: s.slice(7) }
  if (s.startsWith('asset:')) return { raw, kind: 'asset', id: s.slice(6) }
  if (s.startsWith('household:')) return { raw, kind: 'household', id: s.slice(10) }
  if (s.startsWith('ref:param.')) return { raw, kind: 'param', id: s.slice(10) }
  if (s.startsWith('ref:fx.')) return { raw, kind: 'fx', id: s.slice(7) }
  if (s.startsWith('timeline:')) return { raw, kind: 'timeline', id: s.slice(9) }
  if (/^v\d+$/.test(s)) return { raw, kind: 'version', id: s }
  if (/^tl-\d+$/.test(s) || s.startsWith('extension-')) return { raw, kind: 'timeline', id: s }
  if (/^[A-Za-z0-9-]+\.[^\s]+$/.test(s)) return { raw, kind: 'line', id: s }
  return { raw, kind: 'unknown', id: s }
}

export interface Resolved {
  ref: Ref
  /** short human label */
  title: string
  /** secondary line: where it lives */
  sub: string
  /** a value worth showing next to it, if any */
  value?: string | number | boolean | null
  /** icon name from ui.jsx */
  icon: string
  /** where clicking goes (app-relative), if it has a home */
  href?: string
  /** document and page to open in the viewer, if it has one */
  doc?: { id: string; page: number; ev?: string }
  found: boolean
}

const KIND_ICON: Record<RefKind, string> = {
  line: 'grid', ev: 'doc', doc: 'doc', docPage: 'doc', qa: 'chat', msg: 'mail', call: 'phone',
  py: 'history', agency: 'shield', asset: 'key', household: 'user', param: 'scale', fx: 'globe',
  timeline: 'clock', version: 'refresh', unknown: 'help',
}

export function resolveRef(m: Model, raw: string): Resolved {
  const ref = parseRef(raw)
  const base = { ref, icon: KIND_ICON[ref.kind], found: true }
  switch (ref.kind) {
    case 'line': {
      const l = m.current.lines.get(ref.id)
      if (!l) return { ...base, title: ref.id, sub: 'Not a line in the current version', found: false }
      return { ...base, title: l.label, sub: `${l.form} line ${l.line}`, value: l.value, href: `?trace=${encodeURIComponent(l.key)}` }
    }
    case 'ev': {
      const e = m.evs.get(ref.id)
      if (!e) return { ...base, title: ref.id, sub: 'Unknown extracted value', found: false }
      const d = m.docs.get(e.document_id)
      return {
        ...base, title: e.label, sub: `${e.document_id} page ${e.page} - ${d?.title ?? ''}`, value: e.value,
        href: C(`/documents/${e.document_id}?page=${e.page}&ev=${e.id}`), doc: { id: e.document_id, page: e.page, ev: e.id },
      }
    }
    case 'doc':
    case 'docPage': {
      const d = m.docs.get(ref.id)
      if (!d) return { ...base, title: ref.id, sub: 'Unknown document', found: false }
      const page = ref.page ?? 1
      return { ...base, title: d.title, sub: ref.page ? `${d.id} page ${page} (not extracted)` : `${d.id} - ${d.issuer}`, href: C(`/documents/${d.id}?page=${page}`), doc: { id: d.id, page } }
    }
    case 'qa': {
      const q = m.qa.get(ref.id)
      return q ? { ...base, title: q.question, sub: `Client questionnaire ${q.id} - ${q.answered_by}`, value: q.answer } : { ...base, title: ref.id, sub: 'Unknown answer', found: false }
    }
    case 'msg': {
      const x = m.messages.get(ref.id)
      return x ? { ...base, title: `Message from ${x.from}`, sub: `${x.id} - ${x.sent_at.slice(0, 10)}`, value: x.text } : { ...base, title: ref.id, sub: 'Unknown message', found: false }
    }
    case 'call': {
      const c = m.calls.get(ref.id)
      return c ? { ...base, title: `Call with ${c.participants.join(', ')}`, sub: `${c.id} - ${c.date.slice(0, 10)}`, value: c.notes.join(' ') } : { ...base, title: ref.id, sub: 'Unknown call', found: false }
    }
    case 'py': {
      const v = getPointer(m.packet.prior_years, ref.pointer!)
      return { ...base, title: prettyPointer(ref.pointer!), sub: 'Prior-year records', value: scalarOrSummary(v), found: v !== undefined }
    }
    case 'agency': {
      const v = getPointer(m.packet.tax_agency_records, ref.pointer!)
      return { ...base, title: prettyPointer(ref.pointer!), sub: 'Tax agency records', value: scalarOrSummary(v), found: v !== undefined }
    }
    case 'asset': {
      const a = m.current.assets.get(ref.id)
      return a ? { ...base, title: a.description, sub: `Asset ${a.asset_id} - ${a.activity}`, value: a.cost } : { ...base, title: ref.id, sub: 'Prior-year asset record', found: true }
    }
    case 'household': {
      const p = m.people.get(ref.id)
      return p ? { ...base, title: p.name, sub: `Household - ${p.role}${p.relationship ? `, ${p.relationship}` : ''}` } : { ...base, title: ref.id, sub: 'Unknown person', found: false }
    }
    case 'param': {
      const v = m.packet.engine_reference.parameters[ref.id]
      return { ...base, title: ref.id.replace(/_/g, ' '), sub: 'Engine parameter', value: scalarOrSummary(v), found: v !== undefined }
    }
    case 'fx': {
      const [cur, rate] = ref.id.split('.')
      const v = (m.packet.engine_reference.parameters.fx as Record<string, Record<string, number>>)?.[cur]?.[rate]
      return { ...base, title: `${cur} ${rate.replace(/_/g, ' ')}`, sub: 'Exchange rate (units per USD)', value: v, found: v !== undefined }
    }
    case 'timeline': {
      const t = m.timeline.find((x) => x.id === ref.id)
      return t ? { ...base, title: t.event.replace(/_/g, ' '), sub: `Timeline ${t.id} - ${t.at.slice(0, 10)}`, value: t.detail } : { ...base, title: ref.id, sub: 'Timeline', found: false }
    }
    case 'version': {
      const v = m.versions.get(ref.id)
      return v ? { ...base, title: `Engine ${v.v.version}`, sub: v.v.computed_at.slice(0, 10), value: v.v.trigger } : { ...base, title: ref.id, sub: 'Version', found: false }
    }
    default:
      return { ...base, title: ref.raw, sub: 'Reference', found: false }
  }
}

function prettyPointer(p: string): string {
  return p.split('/').filter(Boolean).map((s) => s.replace(/_/g, ' ')).join(' / ')
}

function scalarOrSummary(v: unknown): string | number | boolean | null {
  if (v == null) return null
  if (typeof v === 'object') return Array.isArray(v) ? `${v.length} records` : 'Record'
  return v as string | number | boolean
}
