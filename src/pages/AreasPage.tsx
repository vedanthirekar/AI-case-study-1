// The records a CPA expects, each built from the packet and the log, every number traceable.
import { useEffect, type ComponentType } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useShell } from '../components/shell/ShellContext'
import { Icon, cx } from '../components/ui'
import { useTrace } from '../features/trace/useTrace'
import TracePanel from '../features/trace/TracePanel'
import Sales from '../features/areas/Sales'
import { Depreciation, BooksToTax, Rentals, PassThroughs } from '../features/areas/records1'
import { StateSplit, Payments, Carryovers, RetirementForeign, Deductions } from '../features/areas/records2'
import { Variance, PriorPreparer, TaxComputation, Completeness } from '../features/areas/records3'

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
  const id = params.get('r') ?? 'variance'
  const rec = RECORDS.find((r) => r.id === id) ?? RECORDS[0]
  useEffect(() => { publish({ crumbs: [{ label: 'Areas', to: '/areas' }, { label: rec.label }] }) }, [publish, rec])
  return (
    <div className="flex h-full min-h-0">
      <nav className="pane hidden w-56 shrink-0 overflow-y-auto border-r border-line bg-surface p-2 lg:block">
        <div className="px-2 pb-1 pt-1 text-micro font-bold uppercase tracking-wider text-faint">Records</div>
        {RECORDS.map((r) => (
          <button key={r.id} onClick={() => setParams({ r: r.id })}
            className={cx('flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-body transition',
              r.id === rec.id ? 'bg-accent-soft/70 text-accent shadow-[inset_2px_0_0_rgb(var(--c-accent))]' : 'text-muted hover:bg-slateSoft hover:text-ink')}>
            <Icon name={r.icon} size={15} /><span className="truncate">{r.label}</span>
          </button>
        ))}
      </nav>
      <div className="pane min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-5"><rec.C /></div>
      </div>
      {traceKey && <TracePanel lineKey={traceKey} />}
    </div>
  )
}
