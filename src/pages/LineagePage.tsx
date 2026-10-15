// Lineage: one number as a graph. Sources on the left, the chain of lines in the
// middle, what it feeds on the right. Click any line to re-center; its trace opens alongside.
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useShell } from '../components/shell/ShellContext'
import { Icon, Tag, cx } from '../components/ui'
import { useModel } from '../state/app'
import { useTrace } from '../features/trace/useTrace'
import TracePanel from '../features/trace/TracePanel'
import LineageGraph from '../features/graph/LineageGraph'

const PRESETS: [string, string][] = [
  ['F1040.24', 'Total tax'], ['F1040.11', 'AGI'], ['SchC.31', 'Schedule C profit'], ['SchD.16', 'Capital gains'],
  ['SchA.17', 'Itemized deductions'], ['SchCA540NR.1.E', 'California wages'], ['F1040.37', 'Amount owed'],
]

export default function LineagePage() {
  const m = useModel()
  const { publish } = useShell()
  const [params, setParams] = useSearchParams()
  const { key: traceKey } = useTrace()
  const focus = params.get('k') && m.current.lines.has(params.get('k')!) ? params.get('k')! : 'F1040.11'
  const [up, setUp] = useState(3)
  const [down, setDown] = useState(1)
  const [cap, setCap] = useState(8)
  const [q, setQ] = useState('')
  const options = useMemo(() => ({ up, down, cap }), [up, down, cap])
  const line = m.current.lines.get(focus)!
  useEffect(() => { publish({ crumbs: [{ label: 'Lineage', to: '/lineage' }, { label: `${line.label} (${focus})` }] }) }, [publish, focus, line])

  const setFocus = (k: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('k', k); n.set('trace', k); n.delete('ev'); return n })
  const go = () => { const k = q.trim(); if (m.current.lines.has(k)) { setFocus(k); setQ('') } }

  const sel = 'rounded-lg border border-line bg-surface px-2 py-1 text-meta'
  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
          <Icon name="route" size={16} className="text-accent" />
          <span className="font-display text-title font-bold">Lineage</span>
          <span className="truncate text-meta text-muted">{line.label} · <span className="font-mono">{focus}</span></span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input list="lineage-lines" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} placeholder="Jump to a line key"
              className="w-44 rounded-lg border border-line bg-surface px-2 py-1 font-mono text-meta" />
            <datalist id="lineage-lines">{m.current.order.map((k) => <option key={k} value={k}>{m.current.lines.get(k)!.label}</option>)}</datalist>
            <label className="text-micro text-muted">Back <select value={up} onChange={(e) => setUp(Number(e.target.value))} className={sel}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}</select></label>
            <label className="text-micro text-muted">Forward <select value={down} onChange={(e) => setDown(Number(e.target.value))} className={sel}>{[0, 1, 2, 3].map((n) => <option key={n}>{n}</option>)}</select></label>
            <label className="text-micro text-muted">Per node <select value={cap} onChange={(e) => setCap(Number(e.target.value))} className={sel}>{[4, 8, 12, 20].map((n) => <option key={n}>{n}</option>)}</select></label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line2 bg-bgtint/60 px-4 py-1.5">
          {PRESETS.map(([k, l]) => (
            <button key={k} onClick={() => setFocus(k)} className={cx('rounded-sm border px-2 py-0.5 text-micro font-semibold transition', k === focus ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-ink')}>{l}</button>
          ))}
          <span className="ml-auto flex items-center gap-1.5 text-micro text-muted">
            <Tag tone="muted">Unverified</Tag><Tag tone="good">Verified</Tag><Tag tone="accent">Adjusted</Tag><Tag tone="warn">Flagged</Tag><Tag tone="danger">Blocks filing</Tag>
            <span className="ml-1">dashed = read from a document</span>
          </span>
        </div>
        <div className="min-h-0 flex-1 bg-bg">
          <LineageGraph focus={focus} options={options} onFocus={setFocus} />
        </div>
      </div>
      {traceKey && <TracePanel lineKey={traceKey} />}
    </div>
  )
}
