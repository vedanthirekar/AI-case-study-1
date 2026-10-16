// Schedules: the return's lines by review area (with sign-offs) and the records a
// CPA expects, behind one menu. Any number opens its trace beside the content.
import { useEffect, type ComponentType } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useShell } from '../components/shell/ShellContext'
import { Icon, cx } from '../components/ui'
import { AREAS, areaOf } from '../lib/packet/areas'
import { useTrace } from '../features/trace/useTrace'
import TracePanel from '../features/trace/TracePanel'
import Sales from '../features/areas/Sales'
import { Depreciation, BooksToTax, Rentals, PassThroughs } from '../features/areas/records1'
import { StateSplit, Payments, Carryovers, RetirementForeign, Deductions } from '../features/areas/records2'
import { Variance, PriorPreparer, TaxComputation, Completeness } from '../features/areas/records3'
import { AreaLines, useAreaCounts } from './ReturnPage'

const RECORDS: { id: string; label: string; icon: string; C: ComponentType }[] = [
  { id: 'variance', label: 'Summary vs last year', icon: 'trending', C: Variance },
  { id: 'computation', label: 'Tax computation', icon: 'scale', C: TaxComputation },
  { id: 'sales', label: 'Sales detail', icon: 'grid', C: Sales },
  { id: 'depreciation', label: 'Depreciation by asset', icon: 'key', C: Depreciation },
  { id: 'books', label: 'Books to tax', icon: 'book', C: BooksToTax },
  { id: 'rentals', label: 'Rentals and passive losses', icon: 'home', C: Rentals },
  { id: 'k1', label: 'K-1s and basis by year', icon: 'link', C: PassThroughs },
  { id: 'retirement', label: 'Retirement and foreign', icon: 'globe', C: RetirementForeign },
  { id: 'deductions', label: 'Deductions and credits', icon: 'check-double', C: Deductions },
  { id: 'payments', label: 'Payments', icon: 'send', C: Payments },
  { id: 'state', label: 'State split', icon: 'columns', C: StateSplit },
  { id: 'carryovers', label: 'Carryovers', icon: 'history', C: Carryovers },
  { id: 'prior', label: 'Prior preparer vs us', icon: 'users', C: PriorPreparer },
  { id: 'completeness', label: 'Completeness', icon: 'shield', C: Completeness },
]

export default function AreasPage() {
  const [params, setParams] = useSearchParams()
  const { publish } = useShell()
  const { key: traceKey } = useTrace()
  const counts = useAreaCounts()
  const r = params.get('r')
  const area = params.get('area') ?? (!r ? (traceKey ? areaOf(traceKey) : 'summary') : null)
  const rec = r ? RECORDS.find((x) => x.id === r) ?? RECORDS[0] : null
  const areaLabel = AREAS.find((a) => a.id === area)?.label
  useEffect(() => { publish({ crumbs: [{ label: 'Schedules' }, { label: rec ? rec.label : areaLabel ?? '' }] }) }, [publish, rec, areaLabel])

  const item = (active: boolean) => cx('flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-body transition',
    active ? 'bg-accent-soft/70 text-accent shadow-[inset_2px_0_0_rgb(var(--c-accent))]' : 'text-muted hover:bg-slateSoft hover:text-ink')
  const keepTrace = (p: Record<string, string>) => setParams(() => { const n = new URLSearchParams(p); if (traceKey) n.set('trace', traceKey); return n })

  return (
    <div className="flex h-full min-h-0">
      <nav className="pane hidden w-56 shrink-0 overflow-y-auto border-r border-line bg-surface p-2 lg:block">
        <div className="px-2 pb-1 pt-1 text-micro font-bold uppercase tracking-wider text-faint">Lines by area</div>
        {AREAS.map((a) => {
          const c = counts.get(a.id)
          return (
            <button key={a.id} onClick={() => keepTrace({ area: a.id })} className={item(!rec && a.id === area)}>
              <Icon name={a.icon} size={14} /><span className="min-w-0 flex-1 truncate">{a.label}</span>
              {c && c.flagged > 0 && <span className="tnum text-micro font-semibold text-warn">{c.flagged}</span>}
            </button>
          )
        })}
        <div className="px-2 pb-1 pt-4 text-micro font-bold uppercase tracking-wider text-faint">Schedules</div>
        {RECORDS.map((x) => (
          <button key={x.id} onClick={() => keepTrace({ r: x.id })} className={item(rec?.id === x.id)}>
            <Icon name={x.icon} size={14} /><span className="truncate">{x.label}</span>
          </button>
        ))}
      </nav>
      <div className="pane min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-5">{rec ? <rec.C /> : <AreaLines area={area ?? 'summary'} />}</div>
      </div>
      {traceKey && <TracePanel lineKey={traceKey} />}
    </div>
  )
}
