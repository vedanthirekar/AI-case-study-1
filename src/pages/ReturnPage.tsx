// The return, by review area. Every number opens its trace beside the list.
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useShell } from '../components/shell/ShellContext'
import { Table, Th, Tr, Td, TGroup } from '../components/Table'
import StatusBadge, { StatusLegend } from '../components/StatusBadge'
import { Icon, Tooltip, cx } from '../components/ui'
import { AREAS, areaOf } from '../lib/packet/areas'
import { effectiveValue } from '../lib/workpaper/derive'
import { fmtNum, fmtValue } from '../lib/format'
import { useDerived, useModel } from '../state/app'
import { useFindings, findingsByLine } from '../features/findings'
import { lineState } from '../features/lineStatus'
import { LINE_STATE } from '../features/vocab'
import { useTrace } from '../features/trace/useTrace'
import TracePanel from '../features/trace/TracePanel'

/** Forms with many detail lines show totals first; detail expands on request. */
const DETAIL_FORMS = new Set(['F8949'])

export default function ReturnPage() {
  const m = useModel()
  const d = useDerived()
  const findings = useFindings()
  const byLine = useMemo(() => findingsByLine(findings), [findings])
  const { publish } = useShell()
  const { key: traceKey, open } = useTrace()
  const [params, setParams] = useSearchParams()
  const area = params.get('area') ?? (traceKey ? areaOf(traceKey) : 'summary')
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [legend, setLegend] = useState(false)

  useEffect(() => { publish({ crumbs: [{ label: 'Return', to: '/return' }, { label: AREAS.find((a) => a.id === area)?.label ?? area }] }) }, [publish, area])

  const counts = useMemo(() => {
    const c = new Map<string, { lines: number; flagged: number; verified: number }>()
    for (const k of m.current.order) {
      const a = areaOf(k)
      const s = lineState(k, d, byLine)
      const x = c.get(a) ?? { lines: 0, flagged: 0, verified: 0 }
      x.lines++; if (s === 'flagged' || s === 'blocking') x.flagged++; if (s === 'verified') x.verified++
      c.set(a, x)
    }
    return c
  }, [m, d, byLine])

  const query = q.trim().toLowerCase()
  const keys = m.current.order.filter((k) => query
    ? (k.toLowerCase().includes(query) || m.current.lines.get(k)!.label.toLowerCase().includes(query))
    : areaOf(k) === area)
  // Lines an adjustment adds (e.g. a sale on a page the pipeline never read).
  const added = d.adjustments.filter((a) => a.status !== 'rejected' && !m.current.lines.has(a.lineKey) && (query ? a.lineKey.toLowerCase().includes(query) : a.area === area))

  const groups = new Map<string, string[]>()
  for (const k of keys) {
    const l = m.current.lines.get(k)!
    const g = l.form === 'F8949' ? `F8949 box ${k.split('.')[1]}` : l.form
    groups.set(g, [...(groups.get(g) ?? []), k])
  }
  const py = m.packet.prior_years.return_2024.lines

  const setArea = (a: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('area', a); return n })

  return (
    <div className="flex h-full min-h-0">
      <nav className="pane hidden w-56 shrink-0 overflow-y-auto border-r border-line bg-surface p-2 lg:block">
        <div className="px-2 pb-1 pt-1 text-micro font-bold uppercase tracking-wider text-faint">Areas</div>
        {AREAS.map((a) => {
          const c = counts.get(a.id)
          return (
            <button key={a.id} onClick={() => setArea(a.id)}
              className={cx('flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-body transition',
                a.id === area && !query ? 'bg-accent-soft/70 text-accent shadow-[inset_2px_0_0_rgb(var(--c-accent))]' : 'text-muted hover:bg-slateSoft hover:text-ink')}>
              <Icon name={a.icon} size={15} />
              <span className="min-w-0 flex-1 truncate">{a.label}</span>
              {c && c.flagged > 0 && <span className="tnum text-micro font-semibold text-warn">{c.flagged}</span>}
            </button>
          )
        })}
      </nav>

      <div className="pane min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-meta font-semibold uppercase tracking-wide text-accent">Return · engine {m.current.v.version}</div>
              <h1 className="font-display text-display font-bold">{query ? `Lines matching "${q}"` : AREAS.find((a) => a.id === area)?.label}</h1>
              {!query && counts.get(area) && (
                <p className="text-body text-muted">{counts.get(area)!.lines} lines · {counts.get(area)!.verified} verified · {counts.get(area)!.flagged} flagged. Click any number to trace it.</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5">
                <Icon name="search" size={14} className="text-faint" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a line in any area"
                  className="w-48 bg-transparent text-body outline-none placeholder:text-faint" />
              </div>
              <Tooltip label="What the statuses mean"><button onClick={() => setLegend((x) => !x)} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:text-ink"><Icon name="help" size={15} /></button></Tooltip>
            </div>
          </div>
          {legend && <div className="mt-3"><StatusLegend vocab={LINE_STATE} title="Line status" /></div>}

          <Table dense className="mt-4">
            <thead><tr><Th className="w-28">Line</Th><Th>Description</Th><Th num className="w-28">2024</Th><Th num className="w-32">2025</Th><Th className="w-32">Status</Th></tr></thead>
            <tbody>
              {[...groups.entries()].map(([g, ks]) => {
                const detail = DETAIL_FORMS.has(m.current.lines.get(ks[0])!.form) && ks.length > 6
                const open_ = expanded.has(g) || !!query
                const totals = ks.filter((k) => /total/.test(k))
                const shown = detail && !open_ ? totals : ks
                return (
                  <Fragment key={g}>
                    <TGroup colSpan={5} right={detail ? (
                      <button onClick={() => setExpanded((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n })} className="font-semibold text-accent hover:underline">
                        {open_ ? 'Show totals only' : `Show all ${ks.length - totals.length} sales`}
                      </button>
                    ) : `${ks.length} line${ks.length > 1 ? 's' : ''}`}>{g}</TGroup>
                    {shown.map((k) => {
                      const l = m.current.lines.get(k)!
                      const ev = effectiveValue(m, d, k)
                      const st = lineState(k, d, byLine)
                      return (
                        <Tr key={k} onClick={() => open(k)} selected={traceKey === k}>
                          <Td mono>{k.replace(/^[^.]+\./, '')}</Td>
                          <Td><span className="line-clamp-1">{l.label}</span></Td>
                          <Td num className="text-muted">{py[k] != null ? fmtNum(py[k]) : ''}</Td>
                          <Td num>
                            <span className={cx(ev.adjusted && 'text-accent')}>{typeof ev.value === 'number' ? fmtNum(ev.value) : fmtValue(ev.value)}</span>
                            {ev.adjusted && <div className="text-micro text-faint line-through">{fmtValue(ev.original)}</div>}
                          </Td>
                          <Td><StatusBadge vocab={LINE_STATE} value={st} /></Td>
                        </Tr>
                      )
                    })}
                  </Fragment>
                )
              })}
              {added.length > 0 && <TGroup colSpan={5}>Lines added by adjustments</TGroup>}
              {added.map((a) => (
                <Tr key={a.id} onClick={() => open(a.lineKey)} selected={traceKey === a.lineKey}>
                  <Td mono>{a.lineKey}</Td><Td>{a.reason}</Td><Td num />
                  <Td num><span className="text-accent">{fmtValue(a.to)}</span></Td>
                  <Td><StatusBadge vocab={LINE_STATE} value="adjusted" /></Td>
                </Tr>
              ))}
              {keys.length === 0 && added.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-body text-muted">No lines.</td></tr>}
            </tbody>
          </Table>
        </div>
      </div>

      {traceKey && <TracePanel lineKey={traceKey} />}
    </div>
  )
}
