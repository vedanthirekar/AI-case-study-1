// Building blocks for the area records: a clickable line value, a record frame.
import type { ReactNode } from 'react'
import { Card, Icon, Tag, cx } from '../../components/ui'
import { useDerived, useModel } from '../../state/app'
import { effectiveValue } from '../../lib/workpaper/derive'
import { fmtNum, fmtValue } from '../../lib/format'
import { useTrace } from '../trace/useTrace'

/** A return line's value; click to trace. Shows the adjusted value with the original kept. */
export function LV({ k, className = '' }: { k: string; className?: string }) {
  const m = useModel()
  const d = useDerived()
  const { open, key } = useTrace()
  if (!m.current.lines.has(k) && !d.adjByLine.has(k)) return <span className="text-faint">-</span>
  const ev = effectiveValue(m, d, k)
  const v = typeof ev.value === 'number' && Number.isInteger(ev.value) ? fmtNum(ev.value) : fmtValue(ev.value)
  return (
    <button onClick={() => open(k)} title={`Trace ${k}`}
      className={cx('tnum rounded-sm px-0.5 text-right transition hover:bg-accent-soft hover:text-accent', key === k && 'bg-accent-soft text-accent', ev.adjusted && 'text-accent', className)}>
      {v}{ev.adjusted && <span className="block text-micro text-faint line-through">{fmtValue(ev.original)}</span>}
    </button>
  )
}

export function Rec({ title, intro, children, right }: { title: string; intro?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="font-display text-display font-bold">{title}</h1>
          {intro && <p className="mt-0.5 text-body text-muted">{intro}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

export function Block({ title, children, right, className = '' }: { title: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 className="font-display text-title font-bold">{title}</h2>{right}
      </div>
      {children}
    </Card>
  )
}

/** Tie-out mark: does our independent number agree with the return? */
export function Tie({ ok, label }: { ok: boolean; label?: string }) {
  return ok
    ? <Tag tone="good"><Icon name="check" size={11} />{label ?? 'Ties'}</Tag>
    : <Tag tone="danger"><Icon name="alert" size={11} />{label ?? 'Does not tie'}</Tag>
}

export const n0 = (n: number | null | undefined) => (n == null ? '-' : fmtNum(Math.round(n)))
export const n2 = (n: number | null | undefined) => (n == null ? '-' : fmtNum(n, 2))
