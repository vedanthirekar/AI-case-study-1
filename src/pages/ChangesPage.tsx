// What changed: activity since you last looked, any two versions compared,
// and what-ifs (the engine's computed alternatives plus a scratch estimate).
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useShell } from '../components/shell/ShellContext'
import Tabs from '../components/Tabs'
import { Table, Th, Tr, Td } from '../components/Table'
import { Avatar, Btn, Card, Icon, Tag, cx } from '../components/ui'
import { useApp, useActor, useDerived, useModel } from '../state/app'
import { effectiveValue } from '../lib/workpaper/derive'
import { effectOf } from '../lib/workpaper/effect'
import { fmtDateTime, fmtDate, fmtValue, fmtSigned, fmtMoney } from '../lib/format'
import { usePeople } from '../features/people'
import { describe } from '../features/describe'
import { defaultBasis } from '../features/effectDefaults'
import { EffectLine } from '../features/trace/TracePanel'
import { useTrace } from '../features/trace/useTrace'
import TracePanel from '../features/trace/TracePanel'

type Tab = 'activity' | 'compare' | 'whatif'

export default function ChangesPage() {
  const { publish } = useShell()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) ?? 'activity'
  const { key } = useTrace()
  useEffect(() => { publish({ crumbs: [{ label: 'Changes' }] }) }, [publish])
  return (
    <div className="flex h-full min-h-0">
      <div className="pane min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-4 px-6 py-5">
          <div>
            <div className="text-meta font-semibold uppercase tracking-wide text-accent">Change</div>
            <h1 className="font-display text-display font-bold">What changed</h1>
          </div>
          <Tabs value={tab} onChange={(k) => setParams({ tab: k })} items={[
            { key: 'activity', label: 'Activity', icon: 'history' },
            { key: 'compare', label: 'Compare versions', icon: 'columns' },
            { key: 'whatif', label: 'What-ifs', icon: 'sparkle' },
          ]} />
          {tab === 'activity' && <Activity />}
          {tab === 'compare' && <Compare />}
          {tab === 'whatif' && <WhatIfs />}
        </div>
      </div>
      {key && <TracePanel lineKey={key} />}
    </div>
  )
}

function Activity() {
  const m = useModel()
  const events = useApp((s) => s.events)
  const d = useDerived()
  const actor = useActor()
  const lastSeen = useApp((s) => s.lastSeen[actor.id] ?? 0)
  const markSeen = useApp((s) => s.markSeen)
  const simNow = useApp((s) => s.simNow)
  const people = usePeople()
  const name = (id: string) => people(id).name
  const list = [...events].reverse()
  const fresh = list.filter((e) => e.seq > lastSeen && e.actor !== actor.id).length
  const season = m.timeline.filter((t) => t.at <= simNow).reverse()
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="font-display text-title font-bold">Workpaper activity</h2>
          <div className="flex items-center gap-2">
            {fresh > 0 && <Tag tone="accent" dot>{fresh} new since you last looked</Tag>}
            <Btn size="sm" onClick={markSeen}>Mark all seen</Btn>
          </div>
        </div>
        {list.length === 0 ? <p className="px-4 py-8 text-center text-body text-muted">Nothing yet. Every verification, adjustment, note, sign-off and reveal appears here.</p> : (
          <ul className="pane max-h-[70vh] overflow-y-auto">{list.map((e) => {
            const isNew = e.seq > lastSeen && e.actor !== actor.id
            const undone = d.reversed.has(e.id)
            return (
              <li key={e.id} className={cx('flex items-start gap-2.5 border-b border-line2 px-4 py-2 text-meta last:border-0', isNew && 'bg-accent-soft/40 shadow-[inset_2px_0_0_rgb(var(--c-accent))]')}>
                <Avatar user={people(e.actor).avatar} size={22} />
                <div className="min-w-0 flex-1">
                  <div className={cx('text-ink', undone && 'text-faint line-through')}>{describe(e, m, name)}</div>
                  <div className="text-micro text-faint">{fmtDateTime(e.at)} · season {fmtDate(e.simAt)}{e.batchId && ' · part of a batch'}{undone && ' · undone'}</div>
                </div>
                {isNew && <Tag tone="accent">new</Tag>}
              </li>
            )
          })}</ul>
        )}
      </Card>
      <Card>
        <div className="border-b border-line px-4 py-2.5"><h2 className="font-display text-title font-bold">The season so far</h2></div>
        <ul className="pane max-h-[70vh] overflow-y-auto">{season.map((t) => (
          <li key={t.id} className="border-b border-line2 px-4 py-2 text-meta last:border-0">
            <div className="flex items-center gap-2"><span className="tnum w-24 shrink-0 text-micro text-muted">{fmtDate(t.at)}</span><span className="capitalize text-ink">{t.event.replace(/_/g, ' ')}</span></div>
            {(t.detail || t.refs.length > 0) && <div className="pl-[104px] text-micro text-muted">{t.detail ?? t.refs.join(', ')}</div>}
          </li>
        ))}</ul>
      </Card>
    </div>
  )
}

function Compare() {
  const m = useModel()
  const d = useDerived()
  const { open } = useTrace()
  const options = [...m.versionOrder, 'adjusted']
  const [a, setA] = useState(m.versionOrder[m.versionOrder.length - 2] ?? 'v1')
  const [b, setB] = useState(m.versionOrder[m.versionOrder.length - 1])
  const valuesOf = (v: string): Map<string, number | string> => {
    if (v === 'adjusted') {
      const out = new Map<string, number | string>()
      for (const k of m.current.order) out.set(k, effectiveValue(m, d, k).value ?? '')
      for (const x of d.adjustments) if (x.status !== 'rejected' && !m.current.lines.has(x.lineKey)) out.set(x.lineKey, x.to)
      return out
    }
    return new Map([...m.versions.get(v)!.lines.values()].map((l) => [l.key, l.value]))
  }
  const rows = useMemo(() => {
    const A = valuesOf(a); const B = valuesOf(b)
    const keys = new Set([...A.keys(), ...B.keys()])
    return [...keys].filter((k) => A.get(k) !== B.get(k)).map((k) => ({ k, a: A.get(k), b: B.get(k) }))
  }, [a, b, d]) // eslint-disable-line react-hooks/exhaustive-deps
  const sum = (v: string) => v === 'adjusted'
    ? { tax: m.current.v.summary.federal.total_tax + d.totalEffect.fedTax, bal: m.current.v.summary.federal.balance_due + d.totalEffect.fedBalance, ca: m.current.v.summary.california.total_tax + d.totalEffect.caTax }
    : { tax: m.versions.get(v)!.v.summary.federal.total_tax, bal: m.versions.get(v)!.v.summary.federal.balance_due, ca: m.versions.get(v)!.v.summary.california.total_tax }
  const SA = sum(a); const SB = sum(b)
  const later = b !== 'adjusted' ? m.versions.get(b)!.v : null
  const docsAdded = later && a !== 'adjusted' ? later.documents_used.filter((x) => !m.versions.get(a)!.v.documents_used.includes(x)) : []
  const pick = (v: string, set: (x: string) => void) => (
    <select value={v} onChange={(e) => set(e.target.value)} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-body">
      {options.map((o) => <option key={o} value={o}>{o === 'adjusted' ? 'Adjusted (v3 + adjustments)' : `Engine ${o} (${m.versions.get(o)!.v.computed_at.slice(0, 10)})`}</option>)}
    </select>
  )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">{pick(a, setA)}<Icon name="arrow-right" size={16} className="text-faint" />{pick(b, setB)}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[['Federal total tax', SA.tax, SB.tax], ['Federal balance due', SA.bal, SB.bal], ['California total tax', SA.ca, SB.ca]].map(([l, x, y]) => (
          <Card key={l as string} className="p-3">
            <div className="text-micro font-bold uppercase tracking-wider text-faint">{l}</div>
            <div className="tnum mt-1 text-lead">{fmtMoney(Math.round(x as number))} → <b>{fmtMoney(Math.round(y as number))}</b></div>
            <div className={cx('tnum text-meta', (y as number) - (x as number) > 0 ? 'text-danger' : 'text-good')}>{fmtSigned((y as number) - (x as number))}</div>
          </Card>
        ))}
      </div>
      {later && <Card className="p-3 text-meta"><b>Why {b} was computed:</b> {later.trigger}{docsAdded.length > 0 && <> Documents added since {a}: <span className="font-mono">{docsAdded.join(', ')}</span>.</>}</Card>}
      <Table dense>
        <thead><tr><Th>Line</Th><Th num>{a}</Th><Th num>{b}</Th><Th num>Change</Th></tr></thead>
        <tbody>
          {rows.slice(0, 400).map((r) => (
            <Tr key={r.k} onClick={() => m.current.lines.has(r.k) && open(r.k)}>
              <Td><div>{m.current.lines.get(r.k)?.label ?? r.k}</div><div className="font-mono text-micro text-faint">{r.k}</div></Td>
              <Td num className="text-muted">{r.a == null ? 'added' : fmtValue(r.a)}</Td><Td num>{r.b == null ? 'removed' : fmtValue(r.b)}</Td>
              <Td num>{typeof r.a === 'number' && typeof r.b === 'number' ? fmtSigned(r.b - r.a).replace('$', '') : ''}</Td>
            </Tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-body text-muted">No differences.</td></tr>}
        </tbody>
      </Table>
      <p className="text-micro text-faint">{rows.length} lines differ.</p>
    </div>
  )
}

function WhatIfs() {
  const m = useModel()
  const d = useDerived()
  const [openId, setOpenId] = useState<string | null>(null)
  const [line, setLine] = useState('SchE.14A')
  const [to, setTo] = useState('2300')
  const cur = effectiveValue(m, d, line)
  const target = Number(to.replace(/,/g, ''))
  const valid = m.current.lines.has(line) && typeof cur.value === 'number' && Number.isFinite(target) && to.trim() !== ''
  const delta = valid ? target - (cur.value as number) : 0
  const eff = effectOf(defaultBasis(line, delta), m.current.v.tax_effect_rates)
  return (
    <div className="space-y-4">
      <p className="text-body text-muted">The engine computed these alternatives exactly. Nothing changes until a decision is recorded or an adjustment is made.</p>
      {m.packet.what_if.alternatives.map((w) => (
        <Card key={w.id}>
          <button onClick={() => setOpenId(openId === w.id ? null : w.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left">
            <Icon name={openId === w.id ? 'chevron-down' : 'chevron'} size={14} className="mt-1 text-faint" />
            <div className="min-w-0 flex-1"><div className="font-semibold text-ink">{w.description}</div>
              <div className="text-micro text-muted">Choices: {Object.entries(w.choices).map(([k, v]) => `${k} = ${v}`).join(', ')} · base {w.base_version}</div></div>
            <div className="text-right text-meta"><div>Federal <b className={cx('tnum', w.federal.total_tax_change > 0 ? 'text-danger' : w.federal.total_tax_change < 0 ? 'text-good' : '')}>{fmtSigned(w.federal.total_tax_change)}</b></div>
              <div>California <b className={cx('tnum', w.california.total_tax_change > 0 ? 'text-danger' : w.california.total_tax_change < 0 ? 'text-good' : '')}>{fmtSigned(w.california.total_tax_change)}</b></div></div>
          </button>
          {openId === w.id && (
            <Table dense className="rounded-none border-0 border-t">
              <thead><tr><Th>Line</Th><Th num>Base</Th><Th num>Alternative</Th></tr></thead>
              <tbody>{w.changed_lines.map((c) => <Tr key={c.key}><Td className="font-mono text-micro">{c.key}</Td><Td num>{fmtValue(c.old)}</Td><Td num>{fmtValue(c.new)}</Td></Tr>)}</tbody>
            </Table>
          )}
        </Card>
      ))}
      <Card className="space-y-2 p-4">
        <h2 className="font-display text-title font-bold">Scratch what-if</h2>
        <p className="text-meta text-muted">Try any line at any value. The estimate uses the engine's per-dollar rates; nothing is saved.</p>
        <div className="flex flex-wrap items-center gap-2 text-meta">
          <input list="wf-lines" value={line} onChange={(e) => setLine(e.target.value)} className="w-40 rounded-lg border border-line bg-surface px-2 py-1 font-mono" />
          <datalist id="wf-lines">{m.current.order.map((k) => <option key={k} value={k}>{m.current.lines.get(k)!.label}</option>)}</datalist>
          <span className="text-muted">{m.current.lines.get(line)?.label ?? 'unknown line'} · now {fmtValue(cur.value)} · try</span>
          <input value={to} onChange={(e) => setTo(e.target.value)} className="tnum w-32 rounded-lg border border-line bg-surface px-2 py-1" />
        </div>
        {valid && <EffectLine fedTax={eff.fedTax} caTax={eff.caTax} fedBal={eff.fedBalance} caBal={eff.caBalance} />}
      </Card>
    </div>
  )
}
