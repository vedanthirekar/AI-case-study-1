// The assistant's tools, run in the browser against the workpaper this tab holds.
// Each is a thin read-only view over code the screens already use (the model's
// indexes, the ref resolver, the projection, the checks). Outputs are compact
// JSON, with sensitive values masked the same way the screens mask them.
import type { Model } from '../../lib/packet/model'
import type { Derived } from '../../lib/workpaper/derive'
import { effectiveValue, hashOf, scopeSnapshot } from '../../lib/workpaper/derive'
import type { WPEvent } from '../../lib/workpaper/events'
import { resolveRef } from '../../lib/packet/refs'
import { areaOf, AREA_BY_ID } from '../../lib/packet/areas'
import { magnitude, type Effect } from '../../lib/workpaper/effect'
import type { ReviewedFinding } from '../findings'
import { evidenceDocs } from '../findings'
import { docStatus } from '../documents/docStatus'
import { describe } from '../describe'
import { maskText } from '../Sensitive'

export interface ToolCtx {
  m: Model
  d: Derived
  findings: ReviewedFinding[]
  events: WPEvent[]
  simNow: string
  name: (id: string) => string
}

const round = (n: number) => Math.round(n)
const words = (q?: string) => (q ?? '').toLowerCase().split(/\s+/).filter(Boolean)
const matches = (text: string, q?: string) => { const t = text.toLowerCase(); return words(q).every((w) => t.includes(w)) }
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}... [truncated]` : s)
/** Mask sensitive patterns in every string of a result. */
const scrub = (v: unknown): unknown =>
  typeof v === 'string' ? maskText(v) : Array.isArray(v) ? v.map(scrub)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'ssn' ? 'masked' : scrub(x)])) : v

export function effectText(e: Effect) {
  const parts: string[] = []
  if (round(e.fedTax)) parts.push(`federal tax ${e.fedTax > 0 ? '+' : ''}${round(e.fedTax)}`)
  if (round(e.fedBalance) && round(e.fedBalance) !== round(e.fedTax)) parts.push(`federal balance due ${e.fedBalance > 0 ? '+' : ''}${round(e.fedBalance)}`)
  if (round(e.caTax)) parts.push(`California tax ${e.caTax > 0 ? '+' : ''}${round(e.caTax)}`)
  if (round(e.caBalance) && round(e.caBalance) !== round(e.caTax)) parts.push(`California balance due ${e.caBalance > 0 ? '+' : ''}${round(e.caBalance)}`)
  return parts.length ? `${parts.join(', ')} (estimate)` : 'no tax effect'
}

function arrived(m: Model, simNow: string) {
  return m.packet.documents.filter((x) => x.received_at <= simNow)
}

function lineBrief(ctx: ToolCtx, key: string) {
  const l = ctx.m.current.lines.get(key)
  if (!l) return { key, missing: true }
  const ev = effectiveValue(ctx.m, ctx.d, key)
  return { key, label: l.label, value: ev.value, ...(ev.adjusted ? { engine_value: ev.original } : {}) }
}

function findingBrief(f: ReviewedFinding) {
  return { id: `finding:${f.id}`, title: f.title, severity: f.severity, status: f.status, area: AREA_BY_ID.get(f.area)?.label ?? f.area, tax_effect: effectText(f.effect), lines: f.lines }
}

function sourceField(m: Model, s: string) {
  const e = m.evs.get(s)
  if (!e) { const r = resolveRef(m, s); return { ref: s, title: r.title, value: r.value ?? undefined } }
  return { ref: e.id, document: e.document_id, page: e.page, field: e.label, value: e.value, text_as_read: e.text_as_read, confidence: e.confidence }
}

/** A line's inputs as a tree, `depth` levels down, capped so one call stays small. */
function lineTree(ctx: ToolCtx, key: string, depth: number, budget: { n: number }): unknown {
  const l = ctx.m.current.lines.get(key)
  budget.n--
  if (!l) return { key, missing: true }
  const node: Record<string, unknown> = { ...lineBrief(ctx, key), rule: l.rule }
  if (l.sources.length) node.source_fields = l.sources.slice(0, 8).map((s) => sourceField(ctx.m, s))
  if (l.inputs.length) {
    node.built_from = depth > 0 && budget.n > 0
      ? l.inputs.map((i) => (budget.n > 0 ? lineTree(ctx, i, depth - 1, budget) : lineBrief(ctx, i)))
      : l.inputs.map((i) => lineBrief(ctx, i))
  }
  return node
}

const TOOLS: Record<string, (ctx: ToolCtx, input: Record<string, unknown>) => unknown> = {
  get_line(ctx, { key, depth }) {
    const { m, d, findings } = ctx
    const k = String(key)
    const l = m.current.lines.get(k)
    if (!l) {
      const near = m.current.order.filter((x) => x.toLowerCase().includes(k.toLowerCase())).slice(0, 8)
      return { error: `No line ${k} in ${m.current.v.version}.`, did_you_mean: near }
    }
    const ev = effectiveValue(m, d, k)
    const budget = { n: 40 }
    const adj = (d.adjByLine.get(k) ?? []).map((a) => ({ id: a.id, from: a.from, to: a.to, status: a.status, by: ctx.name(a.by), reason: a.reason, tax_effect: effectText(a.effect), finding: a.findingId ? `finding:${a.findingId}` : undefined }))
    return {
      key: k, label: l.label, form: l.form, line: l.line, jurisdiction: l.jurisdiction, area: AREA_BY_ID.get(areaOf(k))?.label,
      value: ev.value, engine_value: l.value, engine_version: m.current.v.version, rule: l.rule, note: l.note,
      built_from_lines: l.inputs.map((i) => lineTree(ctx, i, Math.min(Math.max(Number(depth) || 2, 1), 3) - 1, budget)),
      source_fields: l.sources.map((s) => sourceField(m, s)),
      used_by_lines: (m.current.usedBy.get(k) ?? []).slice(0, 12).map((u) => lineBrief(ctx, u)),
      adjustments: adj,
      verifications: (d.verifications.get(k) ?? []).map((v) => ({ by: ctx.name(v.by), method: v.method, note: v.note, on: v.simAt.slice(0, 10) })),
      issues: findings.filter((f) => f.lines.includes(k)).map(findingBrief),
      prior_year_2024: m.packet.prior_years.return_2024.lines[k],
    }
  },

  search_lines(ctx, { query }) {
    const out = ctx.m.current.v.lines.filter((l) => matches(`${l.key} ${l.form} ${l.label} ${l.note ?? ''}`, String(query)))
    return { count: out.length, lines: out.slice(0, 20).map((l) => lineBrief(ctx, l.key)) }
  },

  list_findings(ctx, { status = 'open', area }) {
    let fs = ctx.findings.filter((f) => status === 'all' || f.status === status)
    if (area) fs = fs.filter((f) => f.area === area || matches(`${f.area} ${AREA_BY_ID.get(f.area)?.label ?? ''}`, String(area)))
    return { count: fs.length, ranked_by: 'estimated tax at stake', findings: fs.map(findingBrief) }
  },

  get_finding(ctx, { id }) {
    const fid = String(id).replace(/^finding:/, '')
    const f = ctx.findings.find((x) => x.id === fid)
    if (!f) return { error: `No finding ${fid}.`, ids: ctx.findings.map((x) => `finding:${x.id}`) }
    const dis = ctx.d.dismissals.get(f.id)
    return {
      ...findingBrief(f), check: f.check, source: f.source, summary: f.summary, next_step: f.nextStep, blocks_filing: !!f.blocksFiling,
      partner_signoff_needed: magnitude(f.effect) > ctx.d.standards.partner_threshold,
      evidence: f.evidence.map((e) => { const r = resolveRef(ctx.m, e); return { ref: e, title: r.title, where: r.sub, value: r.value ?? undefined } }),
      proposed_corrections: f.proposals.map((p) => ({ line: p.lineKey, from: p.from, to: p.to, reason: p.reason })),
      adjustments_made: ctx.d.adjustments.filter((a) => a.findingId === f.id).map((a) => ({ line: a.lineKey, to: a.to, status: a.status, by: ctx.name(a.by), decided_by: a.decidedBy ? ctx.name(a.decidedBy) : undefined })),
      dismissed: dis ? { by: ctx.name(dis.by), reason: dis.reason } : undefined,
    }
  },

  list_documents(ctx, { status, query }) {
    const { m, simNow } = ctx
    const ev = evidenceDocs(ctx.findings, (e) => m.evs.get(e)?.document_id)
    const rows = m.packet.documents.map((doc) => {
      const st = docStatus(m, doc, simNow, ev)
      return { id: doc.id, title: doc.title, type: doc.document_type, issuer: doc.issuer, received: doc.received_at.slice(0, 10), status: st.state, reason: st.reason, lines: st.lines.length }
    }).filter((r) => (!status || r.status === status || (status === 'no_lines' && r.status !== 'pending' && !r.lines)) && matches(`${r.id} ${r.title} ${r.type} ${r.issuer}`, query as string))
    return { count: rows.length, documents: rows }
  },

  get_document(ctx, { id, page }) {
    const { m, simNow } = ctx
    const doc = m.docs.get(String(id))
    if (!doc) return { error: `No document ${id}.` }
    if (doc.received_at > simNow) return { id: doc.id, title: doc.title, status: `Not received yet; arrives ${doc.received_at.slice(0, 10)}.` }
    const st = docStatus(m, doc, simNow, evidenceDocs(ctx.findings, (e) => m.evs.get(e)?.document_id))
    const pages = page ? doc.pages.filter((p) => p.page === Number(page)) : doc.pages
    let budget = 9000
    return {
      id: doc.id, title: doc.title, type: doc.document_type, issuer: doc.issuer, belongs_to: doc.belongs_to, received: doc.received_at.slice(0, 10),
      uploaded_by: doc.uploaded_by, page_count: doc.page_count, corrected: !!doc.marked_corrected,
      status: st.state, status_reason: st.reason, feeds_lines: st.lines.map((k) => lineBrief(ctx, k)),
      extraction: doc.extraction,
      extracted_values: (m.evsByDoc.get(doc.id) ?? []).filter((e) => !page || e.page === Number(page)).slice(0, 60)
        .map((e) => ({ ref: e.id, page: e.page, field: e.label, value: e.value, text_as_read: e.text_as_read, confidence: e.confidence })),
      pages: pages.map((p) => { const t = clip(p.printed_content, Math.max(400, budget)); budget -= t.length; return { page: p.page, printed_text: t } }),
    }
  },

  search_documents(ctx, { query }) {
    const q = String(query).toLowerCase().trim()
    if (!q) return { error: 'Empty query.' }
    const hits: { ref: string; document: string; title: string; snippet: string }[] = []
    for (const doc of arrived(ctx.m, ctx.simNow)) {
      for (const p of doc.pages) {
        const t = p.printed_content
        const i = t.toLowerCase().indexOf(q)
        if (i >= 0) hits.push({ ref: `doc:${doc.id}#page${p.page}`, document: doc.id, title: doc.title, snippet: t.slice(Math.max(0, i - 160), i + q.length + 160).replace(/\s+/g, ' ') })
      }
    }
    const evs = ctx.m.packet.extracted_values.filter((e) => matches(`${e.label} ${e.field} ${e.text_as_read}`, q) && (ctx.m.docs.get(e.document_id)?.received_at ?? '') <= ctx.simNow)
    return {
      text_hits: hits.length, hits: hits.slice(0, 15),
      extracted_values: evs.slice(0, 15).map((e) => ({ ref: e.id, document: e.document_id, page: e.page, field: e.label, value: e.value })),
    }
  },

  resolve_ref(ctx, { ref }) {
    const r = resolveRef(ctx.m, String(ref))
    if (r.ref.kind === 'line') return TOOLS.get_line(ctx, { key: r.ref.id })
    if (r.ref.kind === 'doc' || r.ref.kind === 'docPage') return TOOLS.get_document(ctx, { id: r.ref.id, page: r.ref.page })
    let raw: unknown
    if (r.ref.kind === 'py' || r.ref.kind === 'agency') {
      const root = r.ref.kind === 'py' ? ctx.m.packet.prior_years : ctx.m.packet.tax_agency_records
      raw = r.ref.pointer!.replace(/^\//, '').split('/').reduce<unknown>((o, k) => (o == null ? o : (o as Record<string, unknown>)[k.replace(/~1/g, '/').replace(/~0/g, '~')]), root)
    }
    if (r.ref.kind === 'asset') raw = ctx.m.current.assets.get(r.ref.id)
    if (r.ref.kind === 'version') { const v = ctx.m.versions.get(r.ref.id)?.v; raw = v && { computed_at: v.computed_at, trigger: v.trigger, summary: v.summary, changes: v.changes_from_previous.slice(0, 30) } }
    return { ref: r.ref.raw, kind: r.ref.kind, found: r.found, title: r.title, where: r.sub, value: r.value ?? undefined, record_json: raw === undefined ? undefined : clip(JSON.stringify(raw), 6000) }
  },

  get_client_communications(ctx, { query }) {
    const { m, simNow, d } = ctx
    const day = simNow.slice(0, 10)
    const qa = m.packet.client.questionnaire.filter((x) => x.answered_at.slice(0, 10) <= day && matches(`${x.question} ${x.answer}`, query as string))
    const msgs = m.packet.client.messages.filter((x) => x.sent_at <= simNow && matches(`${x.from} ${x.text}`, query as string))
    const calls = m.packet.client.call_notes.filter((x) => x.date.slice(0, 10) <= day && matches(x.notes.join(' '), query as string))
    const threads = d.threads.filter((t) => matches(t.messages.map((x) => x.text).join(' '), query as string))
    return {
      questionnaire: qa.map((x) => ({ ref: x.id, question: x.question, answer: x.answer, by: x.answered_by })),
      messages: msgs.map((x) => ({ ref: x.id, sent: x.sent_at.slice(0, 10), from: x.from, to: x.to, text: x.text })),
      call_notes: calls.map((x) => ({ ref: x.id, date: x.date.slice(0, 10), participants: x.participants, notes: x.notes })),
      question_threads: threads.map((t) => ({ to: t.to, answered: t.answered, about: t.refs, messages: t.messages.map((x) => ({ by: ctx.name(x.by), on: x.simAt.slice(0, 10), text: x.text })) })),
    }
  },

  get_prior_year(ctx, { query }) {
    const py = ctx.m.packet.prior_years
    const r = py.return_2024
    const q = query as string | undefined
    const lines = Object.entries(r.lines).filter(([k]) => matches(`${k} ${r.line_labels[k] ?? ''}`, q))
    return {
      return_2024: { prepared_by: r.prepared_by, filed: r.filed, residency: r.residency, lines: lines.slice(0, 40).map(([k, v]) => ({ ref: `py:/return_2024/lines/${k}`, key: k, label: r.line_labels[k], value: v, source: r.line_sources[k] })), notes: Object.entries(r.notes).filter(([k, v]) => matches(`${k} ${v}`, q)).map(([k, v]) => ({ ref: `py:/return_2024/notes/${k}`, note: v })) },
      prior_preparer: { memo: py.prior_preparer_workpaper.summary_memo, notes: py.prior_preparer_workpaper.notes.filter((n) => matches(n, q)), open_items: py.prior_preparer_workpaper.open_items_left_by_prior_preparer },
      carryovers_into_2025: py.carryovers_into_2025,
    }
  },

  get_activity(ctx, { query, limit }) {
    const { m, d } = ctx
    const n = Math.min(Number(limit) || 30, 80)
    const evs = d.live.map((e) => ({ when: e.simAt.slice(0, 10), what: describe(e, m, ctx.name) })).filter((e) => matches(e.what, query as string))
    return {
      events: evs.slice(-n),
      total_events: d.live.length,
      signoffs: d.signoffs.map((s) => {
        const now = hashOf(scopeSnapshot(m, d, s.scope))
        return { scope: s.scope, level: s.level, by: ctx.name(s.by), at: s.at.slice(0, 10), state: now === s.hash ? 'current' : 'reopened (what it covered has changed since)' }
      }),
      open_review_notes: d.notes.filter((x) => !x.resolved).map((x) => ({ on: x.refs, by: ctx.name(x.by), blocking: x.blocking, text: x.text })),
      filing: { client_approved: !!d.filing.clientApproval, filed: !!d.filing.frozen, amending: !!d.filing.amending, events: d.filing.events.map((e) => ({ kind: e.payload.kind, on: e.simAt.slice(0, 10), detail: e.payload.detail })) },
    }
  },
}

export function runTool(ctx: ToolCtx, name: string, input: unknown): unknown {
  const fn = TOOLS[name]
  if (!fn) return { error: `Unknown tool ${name}.` }
  return scrub(fn(ctx, (input ?? {}) as Record<string, unknown>))
}
