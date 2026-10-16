// The client file's home: the return as a map, problems lit up where they land,
// and what needs attention beside it. Click a node to zoom into its lineage.
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useShell } from '../components/shell/ShellContext'
import StatusBadge from '../components/StatusBadge'
import { Icon, Tag, cx } from '../components/ui'
import { useApp, useDerived, useModel } from '../state/app'
import { fmtDate, fmtMoney, fmtSigned } from '../lib/format'
import { magnitude } from '../lib/workpaper/effect'
import { AREA_BY_ID } from '../lib/packet/areas'
import { reviewHref, filingHref } from '../lib/paths'
import { useFindings, type ReviewedFinding } from '../features/findings'
import { readiness } from '../features/readiness'
import { SEVERITY } from '../features/vocab'
import { useTrace } from '../features/trace/useTrace'
import TracePanel from '../features/trace/TracePanel'
import ReturnMap from '../features/map/ReturnMap'
import LineageGraph from '../features/graph/LineageGraph'
import { SPINE, spineStats } from '../features/map/spine'
import { FindingDetail } from './ReviewPage'

export default function MapPage() {
  const m = useModel()
  const d = useDerived()
  const simNow = useApp((s) => s.simNow)
  const findings = useFindings()
  const { publish } = useShell()
  const [params, setParams] = useSearchParams()
  const { key: traceKey } = useTrace()
  const [hover, setHover] = useState<string | null>(null)
  const focus = params.get('focus')
  const fid = params.get('f')
  const [depth, setDepth] = useState(2)

  const { stats, landing } = useMemo(() => spineStats(m, d, findings), [m, d, findings])
  const steps = useMemo(() => readiness(m, d, findings, simNow), [m, d, findings, simNow])
  const open = findings.filter((f) => f.status === 'open')
  const selected = findings.find((f) => f.id === fid)
  // Only dim the map when the issue actually lands somewhere on it.
  const lit = hover ?? fid
  const spots = lit ? landing.get(lit) : undefined
  const highlight = spots && spots.length ? new Set(spots) : null
  const focusNode = SPINE.find((n) => n.key === focus)
  const focusLabel = focusNode?.label ?? m.current.lines.get(focus ?? '')?.label ?? focus

  useEffect(() => {
    publish({ crumbs: focus ? [{ label: 'Return map', to: '?' }, { label: `${focusLabel}` }] : [{ label: 'Return map' }] })
  }, [publish, focus, focusLabel])

  const set = (patch: Record<string, string | null>) => setParams((p) => {
    const n = new URLSearchParams(p)
    for (const [k, v] of Object.entries(patch)) { if (v == null) n.delete(k); else n.set(k, v) }
    return n
  })
  const sum = m.current.v.summary
  const e = d.totalEffect
  const fed = Math.round(sum.federal.balance_due + e.fedBalance)
  const ca = Math.round(sum.california.balance_due + e.caBalance)
  const blocking = d.notes.filter((n) => n.blocking && !n.resolved).length
  const done = steps.filter((s) => s.done).length

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* One line of status, not a dashboard. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line bg-surface px-5 py-2.5 text-meta">
        <div>
          <div className="font-display text-title font-bold leading-tight">Okafor-Lindqvist · {m.taxYear}</div>
          <div className="text-micro text-muted">Married filing jointly · CA resident to Jul 14, then TX · engine {m.current.v.version}</div>
        </div>
        <Fig label="Federal" value={fed} />
        <Fig label="California" value={ca} />
        <Link to={reviewHref()} className="flex flex-col leading-tight"><span className="text-micro text-muted">Open issues</span><span className={cx('tnum font-semibold', open.length ? 'text-warn' : 'text-good')}>{open.length}{blocking > 0 && <span className="ml-1 text-danger">· {blocking} blocking</span>}</span></Link>
        <Link to={filingHref()} className="flex flex-col leading-tight"><span className="text-micro text-muted">Steps to filing</span><span className="tnum font-semibold">{done} of {steps.length}</span></Link>
        <span className="ml-auto text-micro text-faint">As of {fmtDate(simNow)} · estimates include adjustments</span>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1 bg-bg">
          {focus ? (
            <>
              <div className="absolute left-3 right-3 top-3 z-10 flex flex-wrap items-center gap-2">
                <button onClick={() => set({ focus: null, trace: null, ev: null })} className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-meta font-semibold shadow-sm hover:border-accent hover:text-accent">
                  <Icon name="back" size={13} />Return map
                </button>
                <span className="rounded-lg border border-line bg-surface px-2.5 py-1 text-meta shadow-sm"><b>{focusLabel}</b> <span className="font-mono text-micro text-faint">{focus}</span></span>
                <label className="ml-auto rounded-lg border border-line bg-surface px-2 py-1 text-micro text-muted shadow-sm">Depth
                  <select value={depth} onChange={(x) => setDepth(Number(x.target.value))} className="ml-1 bg-transparent">{[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}</select></label>
              </div>
              <LineageGraph focus={focus} options={{ up: depth, down: 1, cap: 8 }} onFocus={(k) => set({ focus: k, trace: k, ev: null })} />
            </>
          ) : (
            <>
              <ReturnMap stats={stats} highlight={highlight} onPick={(n) => set({ focus: n.key, trace: n.key, f: null })} />
              <div className="pointer-events-none absolute bottom-3 right-3 max-w-xs rounded-lg border border-line bg-surface/95 px-3 py-2 text-micro text-muted shadow-sm">
                Income on the left flows to what is owed on the right. Issues show where they land. <b className="text-ink">Click any box</b> to see how it was built, down to the source document.
              </div>
            </>
          )}
        </div>

        {traceKey ? <TracePanel lineKey={traceKey} />
          : selected ? <FindingDetail f={selected} onClose={() => { setHover(null); set({ f: null }) }} />
            : <Attention list={open} onPick={(f) => { setHover(null); set({ f: f.id }) }} onHover={setHover} />}
      </div>
    </div>
  )
}

function Fig({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-micro text-muted">{label} {value < 0 ? 'refund' : 'owed'}</span>
      <span className={cx('tnum font-semibold', value < 0 ? 'text-good' : 'text-ink')}>{fmtMoney(Math.abs(value))}</span>
    </div>
  )
}

function Attention({ list, onPick, onHover }: { list: ReviewedFinding[]; onPick: (f: ReviewedFinding) => void; onHover: (id: string | null) => void }) {
  // The list unmounts without a mouseleave when an item is opened: never leave a hover behind.
  useEffect(() => () => onHover(null), [onHover])
  const ranked = list.filter((f) => f.severity !== 'info').sort((a, b) => b.rank - a.rank)
  const total = ranked.reduce((s, f) => s + magnitude(f.effect), 0)
  return (
    <aside className="flex h-full w-[min(340px,32vw)] shrink-0 flex-col border-l border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-display text-title font-bold">Needs attention</h2>
        <p className="text-micro text-muted">{ranked.length} issues from independent checks, biggest first · about {fmtMoney(Math.round(total))} of tax at stake. Hover to see where each lands on the return.</p>
      </div>
      <ul className="pane min-h-0 flex-1 overflow-y-auto" onMouseLeave={() => onHover(null)}>
        {ranked.map((f, i) => (
          <li key={f.id}>
            <button onClick={() => onPick(f)} onMouseEnter={() => onHover(f.id)} onMouseLeave={() => onHover(null)}
              className="flex w-full items-start gap-2.5 border-b border-line2 px-4 py-2.5 text-left transition hover:bg-slateSoft">
              <span className="tnum mt-0.5 w-4 shrink-0 text-micro text-faint">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-meta font-semibold leading-snug text-ink">{f.title}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-micro text-muted"><StatusBadge vocab={SEVERITY} value={f.severity} />{AREA_BY_ID.get(f.area)?.label}</span>
              </span>
              {magnitude(f.effect) >= 1 && <span className={cx('tnum shrink-0 text-meta font-semibold', (f.effect.fedTax || f.effect.fedBalance || f.effect.caTax) > 0 ? 'text-danger' : 'text-good')}>{fmtSigned(f.effect.fedTax || f.effect.fedBalance || f.effect.caTax || f.effect.caBalance)}</span>}
            </button>
          </li>
        ))}
        {ranked.length === 0 && <li className="px-4 py-10 text-center text-body text-muted">Nothing open. <Tag tone="good">Clear</Tag></li>}
      </ul>
      <Link to={reviewHref()} className="flex items-center justify-center gap-1 border-t border-line px-4 py-2.5 text-meta font-semibold text-accent hover:bg-slateSoft">
        Open Review for approvals, questions and history<Icon name="arrow-right" size={13} />
      </Link>
    </aside>
  )
}
