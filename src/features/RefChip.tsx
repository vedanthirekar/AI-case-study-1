// How any reference renders: icon, what it is, where it lives, its value.
// Clicking follows the reference: lines open the trace, values open the page.
import { useNavigate, useLocation } from 'react-router-dom'
import { Icon, cx } from '../components/ui'
import { resolveRef } from '../lib/packet/refs'
import { fmtValue } from '../lib/format'
import { useModel } from '../state/app'
import { maskText } from './Sensitive'
import { useTrace } from './trace/useTrace'

export function RefChip({ id, compact = false, onOpenDoc, className = '' }: {
  id: string; compact?: boolean; className?: string
  /** when given, documents open here instead of navigating */
  onOpenDoc?: (doc: { id: string; page: number; ev?: string }) => void
}) {
  const m = useModel()
  const r = resolveRef(m, id)
  const nav = useNavigate()
  const loc = useLocation()
  const { open } = useTrace()

  const go = () => {
    if (r.ref.kind === 'line' && r.found) {
      if (/^\/(return|review|areas|changes|lineage)/.test(loc.pathname)) open(r.ref.id)
      else nav(`/return?trace=${encodeURIComponent(r.ref.id)}`)
      return
    }
    if (r.doc) { if (onOpenDoc) onOpenDoc(r.doc); else nav(r.href!) }
  }
  const clickable = (r.ref.kind === 'line' && r.found) || !!r.doc
  const value = r.value == null ? null : typeof r.value === 'string' ? maskText(r.value) : fmtValue(r.value)

  const body = (
    <>
      <Icon name={r.icon} size={14} className={cx('mt-0.5 shrink-0', r.found ? 'text-faint' : 'text-warn')} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium text-ink">{r.title}</span>
        {!compact && <span className="block truncate text-micro text-muted">{r.sub}<span className="ml-1.5 font-mono text-faint">{r.ref.raw}</span></span>}
      </span>
      {value != null && <span className={cx('tnum shrink-0 text-meta text-muted', typeof r.value === 'string' && 'max-w-[45%] truncate font-sans')}>{value}</span>}
    </>
  )
  const cls = cx('flex w-full items-start gap-2 rounded-lg border border-line2 bg-surface px-2.5 py-1.5 text-left', className)
  return clickable
    ? <button onClick={go} className={cx(cls, 'transition hover:border-accent/50 hover:bg-slateSoft')}>{body}</button>
    : <div className={cls}>{body}</div>
}

/** Text reference with a value (messages, answers): shows the full text, wrapped. */
export function QuoteRef({ id }: { id: string }) {
  const m = useModel()
  const r = resolveRef(m, id)
  return (
    <div className="rounded-lg border border-line2 bg-surface px-3 py-2">
      <div className="flex items-center gap-1.5 text-micro text-muted">
        <Icon name={r.icon} size={12} />{r.title}<span className="font-mono text-faint">{r.ref.raw}</span>
      </div>
      {typeof r.value === 'string' && <p className="mt-1 text-body text-ink">{maskText(r.value)}</p>}
    </div>
  )
}
