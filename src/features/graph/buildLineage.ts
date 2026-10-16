// The lineage of one number as a graph: where it comes from (inputs, down to the
// document values they were read from) and what it feeds. Walks the same model
// indexes the trace panel uses; caps keep a 300-sale total readable.
import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/react'
import type { Model } from '../../lib/packet/model'
import { resolveRef } from '../../lib/packet/refs'
import { effectiveValue, type Derived } from '../../lib/workpaper/derive'
import { fmtValue } from '../../lib/format'
import { lineState, type LineState } from '../lineStatus'
import type { ReviewedFinding } from '../findings'

export type LineData = { kind: 'line'; key: string; label: string; value: string; original?: string; state: LineState; focus: boolean; rule: string; findings: number }
export type EvData = { kind: 'ev'; id: string; label: string; value: string; doc: string; page: number; confidence: number; used: number }
export type RefData = { kind: 'ref'; raw: string; label: string; sub: string; value?: string; icon: string; href?: string }
export type MoreData = { kind: 'more'; parent: string; count: number; what: string }
export type NodeData = LineData | EvData | RefData | MoreData

export interface LineageOptions { up: number; down: number; cap: number }

const SIZE: Record<NodeData['kind'], [number, number]> = { line: [210, 64], ev: [210, 58], ref: [200, 50], more: [140, 36] }
const MAX_NODES = 220

export function buildLineage(m: Model, d: Derived, byLine: Map<string, ReviewedFinding[]>, focus: string, o: LineageOptions) {
  const nodes = new Map<string, Node<NodeData>>()
  const edges = new Map<string, Edge>()
  const full = () => nodes.size >= MAX_NODES

  const lineNode = (key: string): string => {
    const id = `line:${key}`
    if (!nodes.has(id)) {
      const l = m.current.lines.get(key)
      const ev = effectiveValue(m, d, key)
      nodes.set(id, {
        id, type: 'line', position: { x: 0, y: 0 },
        data: {
          kind: 'line', key, label: l?.label ?? key, value: fmtValue(ev.value), original: ev.adjusted ? fmtValue(ev.original) : undefined,
          state: lineState(key, d, byLine), focus: key === focus, rule: l?.rule ?? '', findings: byLine.get(key)?.length ?? 0,
        },
      })
    }
    return id
  }
  const sourceNode = (raw: string): string | null => {
    const e = m.evs.get(raw)
    if (e) {
      const id = `ev:${raw}`
      if (!nodes.has(id)) nodes.set(id, {
        id, type: 'ev', position: { x: 0, y: 0 },
        data: { kind: 'ev', id: raw, label: e.label, value: fmtValue(e.value), doc: e.document_id, page: e.page, confidence: e.confidence, used: m.current.linesByEv.get(raw)?.length ?? 0 },
      })
      return id
    }
    const r = resolveRef(m, raw)
    if (r.ref.kind === 'line') return null
    const id = `ref:${raw}`
    if (!nodes.has(id)) nodes.set(id, {
      id, type: 'ref', position: { x: 0, y: 0 },
      data: { kind: 'ref', raw, label: r.title, sub: r.sub, value: r.value == null || typeof r.value === 'object' ? undefined : String(r.value).slice(0, 40), icon: r.icon, href: r.href },
    })
    return id
  }
  const more = (parent: string, count: number, what: string, side: 'in' | 'out') => {
    const id = `more:${side}:${parent}`
    nodes.set(id, { id, type: 'more', position: { x: 0, y: 0 }, data: { kind: 'more', parent, count, what } })
    const pid = `line:${parent}`
    if (side === 'in') edge(id, pid, true); else edge(pid, id, true)
  }
  const edge = (source: string, target: string, dashed = false) => {
    const id = `${source}->${target}`
    if (!edges.has(id)) edges.set(id, { id, source, target, type: 'smoothstep', style: dashed ? { strokeDasharray: '4 3' } : undefined })
  }

  // Upstream: what this number is built from.
  const seenUp = new Set<string>()
  const walkUp = (key: string, depth: number) => {
    if (seenUp.has(key)) return
    seenUp.add(key)
    const l = m.current.lines.get(key)
    if (!l) return
    const target = lineNode(key)
    const inputs = l.inputs.filter((k) => m.current.lines.has(k))
    if (depth >= o.up) { if (inputs.length) more(key, inputs.length, 'inputs', 'in'); return }
    const shownIn = inputs.slice(0, o.cap)
    for (const k of shownIn) { if (full()) break; edge(lineNode(k), target); walkUp(k, depth + 1) }
    if (inputs.length > shownIn.length) more(key, inputs.length - shownIn.length, 'more inputs', 'in')
    const srcs = l.sources.slice(0, o.cap)
    for (const s of srcs) { if (full()) break; const n = sourceNode(s); if (n) edge(n, target, true) }
    if (l.sources.length > srcs.length && !inputs.length) more(key, l.sources.length - srcs.length, 'more sources', 'in')
  }
  walkUp(focus, 0)

  // Downstream: what this number feeds.
  const seenDown = new Set<string>([focus])
  const walkDown = (key: string, depth: number) => {
    if (depth >= o.down) return
    const users = m.current.usedBy.get(key) ?? []
    for (const u of users.slice(0, o.cap)) {
      if (full()) break
      edge(lineNode(key), lineNode(u))
      if (!seenDown.has(u)) { seenDown.add(u); walkDown(u, depth + 1) }
    }
    if (users.length > o.cap) more(key, users.length - o.cap, 'more lines it feeds', 'out')
  }
  walkDown(focus, 0)

  // Left-to-right layout: sources, inputs, the number, what it feeds.
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 12, ranksep: 40, marginx: 10, marginy: 10 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of nodes.values()) { const [w, h] = SIZE[n.data.kind]; g.setNode(n.id, { width: w, height: h }) }
  for (const e of edges.values()) g.setEdge(e.source, e.target)
  dagre.layout(g)
  const laid = [...nodes.values()].map((n) => {
    const p = g.node(n.id); const [w, h] = SIZE[n.data.kind]
    return { ...n, position: { x: p.x - w / 2, y: p.y - h / 2 } }
  })
  return { nodes: laid, edges: [...edges.values()], truncated: full() }
}
