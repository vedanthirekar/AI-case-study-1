// The firm: standards (changed only by the administrator, every change kept),
// who saw sensitive data, time against budget, and who owns what.
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useShell } from '../components/shell/ShellContext'
import Tabs from '../components/Tabs'
import { Table, Th, Tr, Td } from '../components/Table'
import { Avatar, Card, Tag, cx } from '../components/ui'
import { useApp, useDerived, useModel } from '../state/app'
import { AREAS } from '../lib/packet/areas'
import { ROLE_LABEL } from '../lib/rules/rules'
import { fmtDate, fmtDateTime } from '../lib/format'
import type { Action } from '../lib/workpaper/events'
import { ActionButton } from '../features/ActionButton'
import { usePeople } from '../features/people'
import { describe } from '../features/describe'

type Tab = 'standards' | 'access' | 'time' | 'team'

export default function FirmPage() {
  const { publish } = useShell()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) ?? 'standards'
  const d = useDerived()
  useEffect(() => { publish({ crumbs: [{ label: 'Firm' }] }) }, [publish])
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-5">
      <div><div className="text-meta font-semibold uppercase tracking-wide text-accent">Miraflores</div><h1 className="font-display text-display font-bold">Firm</h1></div>
      <Tabs value={tab} onChange={(k) => setParams({ tab: k })} items={[
        { key: 'standards', label: 'Standards', icon: 'book' },
        { key: 'access', label: 'Sensitive data log', icon: 'shield', count: d.reveals.length },
        { key: 'time', label: 'Time vs budget', icon: 'clock' },
        { key: 'team', label: 'Team and assignments', icon: 'users' },
      ]} />
      {tab === 'standards' && <Standards />}
      {tab === 'access' && <Access />}
      {tab === 'time' && <Time />}
      {tab === 'team' && <Team />}
    </div>
  )
}

function Standards() {
  const m = useModel()
  const d = useDerived()
  const people = usePeople()
  const s = d.standards
  const [pct, setPct] = useState(String(s.variance_review.flag_if_change_over_percent))
  const [amt, setAmt] = useState(String(s.variance_review.and_over_amount))
  const [thr, setThr] = useState(String(s.partner_threshold))
  const [types, setTypes] = useState(s.verification_types.join(', '))
  const [rules, setRules] = useState(s.rules.join('\n'))
  const changes: Action[] = []
  const push = (path: string, value: unknown, before: unknown) => { if (JSON.stringify(value) !== JSON.stringify(before)) changes.push({ type: 'standard.changed', refs: ['standards'], payload: { path, value } }) }
  push('variance_review.flag_if_change_over_percent', Number(pct), s.variance_review.flag_if_change_over_percent)
  push('variance_review.and_over_amount', Number(amt), s.variance_review.and_over_amount)
  push('partner_threshold', Number(thr), s.partner_threshold)
  push('verification_types', types.split(',').map((x) => x.trim()).filter(Boolean), s.verification_types)
  push('rules', rules.split('\n').map((x) => x.trim()).filter(Boolean), s.rules)
  const history = d.live.filter((e) => e.type === 'standard.changed').reverse()
  const field = 'w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-body'
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <Card className="space-y-3 p-4">
        <p className="text-meta text-muted">{m.packet.firm.starter_standards.note} Changes apply immediately, firm-wide: the variance flags, the partner threshold for approvals and the verification choices all read from here.</p>
        <div className="grid grid-cols-3 gap-2 text-micro text-muted">
          <label>Variance: over %<input value={pct} onChange={(e) => setPct(e.target.value)} className={cx(field, 'tnum mt-0.5')} /></label>
          <label>and over $<input value={amt} onChange={(e) => setAmt(e.target.value)} className={cx(field, 'tnum mt-0.5')} /></label>
          <label>Partner approves tax effect over $<input value={thr} onChange={(e) => setThr(e.target.value)} className={cx(field, 'tnum mt-0.5')} /></label>
        </div>
        <label className="block text-micro text-muted">Verification types (comma separated)<input value={types} onChange={(e) => setTypes(e.target.value)} className={cx(field, 'mt-0.5')} /></label>
        <label className="block text-micro text-muted">Rules (one per line)<textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={8} className={cx(field, 'mt-0.5 text-meta')} /></label>
        <div className="text-micro text-muted">Required steps: {s.required_steps.join(' · ')}</div>
        <ActionButton variant="primary" done="Standards updated" disabledReason={!changes.length ? 'Nothing changed.' : null} actions={changes}>Save {changes.length || ''} change{changes.length === 1 ? '' : 's'}</ActionButton>
      </Card>
      <Card>
        <div className="border-b border-line px-4 py-2.5"><h2 className="font-display text-title font-bold">Change history</h2></div>
        {history.length === 0 ? <p className="px-4 py-4 text-meta text-muted">Starter standards, unchanged.</p> : (
          <ul>{history.map((e) => <li key={e.id} className="border-b border-line2 px-4 py-2 text-meta last:border-0">{describe(e, m, (id) => people(id).name)}<div className="text-micro text-faint">{fmtDateTime(e.at)}</div></li>)}</ul>
        )}
      </Card>
    </div>
  )
}

function Access() {
  const d = useDerived()
  const people = usePeople()
  const actors = useApp((s) => s.actors)
  return (
    <Card>
      <div className="border-b border-line px-4 py-2.5">
        <h2 className="font-display text-title font-bold">Every unmasked view</h2>
        <p className="text-micro text-muted">SSNs, bank and account numbers and IP PINs are masked for everyone by default. Staff with clearance may reveal them; each reveal is recorded here. Staff without clearance cannot reveal at all.</p>
      </div>
      {d.reveals.length === 0 ? <p className="px-4 py-6 text-center text-body text-muted">No sensitive data has been revealed.</p> : (
        <Table dense className="rounded-none border-0">
          <thead><tr><Th>Who</Th><Th>What</Th><Th>When</Th><Th>Season date</Th></tr></thead>
          <tbody>{[...d.reveals].reverse().map((e) => {
            const a = actors.find((x) => x.id === e.actor)
            return (
              <Tr key={e.id}><Td><span className="flex items-center gap-2"><Avatar user={people(e.actor).avatar} size={20} />{people(e.actor).name}<Tag tone={a?.clearance ? 'good' : 'danger'}>{a?.clearance ? 'cleared' : 'no clearance'}</Tag></span></Td>
                <Td>{e.payload.label}</Td><Td className="text-micro">{fmtDateTime(e.at)}</Td><Td className="text-micro">{fmtDate(e.simAt)}</Td></Tr>
            )
          })}</tbody>
        </Table>
      )}
    </Card>
  )
}

function Time() {
  const m = useModel()
  const d = useDerived()
  const people = usePeople()
  const [area, setArea] = useState(AREAS[1].id)
  const [hours, setHours] = useState('1')
  const [note, setNote] = useState('')
  const budget = m.packet.firm.budget_hours
  const totalBudget = Object.values(budget).reduce((a, b) => a + b, 0)
  const totalUsed = d.time.reduce((a, t) => a + t.hours, 0)
  const rows = AREAS.filter((a) => a.budgetKey).map((a) => ({ a, budget: budget[a.budgetKey!], used: d.time.filter((t) => t.area === a.id).reduce((s, t) => s + t.hours, 0) }))
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5"><h2 className="font-display text-title font-bold">By area</h2><span className="tnum text-meta text-muted">{totalUsed} of {totalBudget} hours</span></div>
        <Table dense className="rounded-none border-0">
          <thead><tr><Th>Area</Th><Th num>Budget</Th><Th num>Used</Th><Th className="w-40" /></tr></thead>
          <tbody>{rows.map((r) => (
            <Tr key={r.a.id}><Td>{r.a.label}</Td><Td num>{r.budget}</Td><Td num className={r.used > r.budget ? 'font-semibold text-danger' : ''}>{r.used}</Td>
              <Td><div className="h-1.5 rounded-full bg-slateSoft"><div className={cx('h-1.5 rounded-full', r.used > r.budget ? 'bg-danger-fill' : 'bg-accent-fill')} style={{ width: `${Math.min(100, (r.used / r.budget) * 100)}%` }} /></div></Td></Tr>
          ))}</tbody>
        </Table>
      </Card>
      <Card className="space-y-2 p-4">
        <h2 className="font-display text-title font-bold">Log time</h2>
        <select value={area} onChange={(e) => setArea(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-body">{AREAS.filter((a) => a.budgetKey).map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
        <div className="flex gap-2"><input value={hours} onChange={(e) => setHours(e.target.value)} className="tnum w-20 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-body" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you did" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-body" /></div>
        <ActionButton size="sm" variant="primary" done="Time logged" actions={{ type: 'time.logged', refs: [area], payload: { area, hours: Number(hours), note: note || undefined } }} onDone={() => setNote('')}>Log</ActionButton>
        <ul className="mt-2 max-h-60 overflow-auto">{[...d.time].reverse().map((t) => <li key={t.id} className="border-t border-line2 py-1 text-micro"><b>{people(t.by).name}</b> {t.hours}h · {AREAS.find((a) => a.id === t.area)?.label}{t.note && ` · ${t.note}`}</li>)}</ul>
      </Card>
    </div>
  )
}

function Team() {
  const m = useModel()
  const d = useDerived()
  const people = usePeople()
  const actors = useApp((s) => s.actors)
  const start = m.packet.firm.assignment_at_start
  const [area, setArea] = useState(AREAS[0].id)
  const [who, setWho] = useState(start.preparer)
  const [due, setDue] = useState(m.packet.firm.deadlines.find((x) => /review complete/i.test(x.what))?.date ?? '')
  const staff = actors.filter((a) => a.role !== 'client')
  return (
    <div className="space-y-4">
      <Card>
        <div className="border-b border-line px-4 py-2.5"><h2 className="font-display text-title font-bold">Staff</h2></div>
        <Table dense className="rounded-none border-0">
          <thead><tr><Th>Person</Th><Th>Role</Th><Th>Credential</Th><Th>Clearance</Th><Th>Active from</Th></tr></thead>
          <tbody>{staff.map((a) => (
            <Tr key={a.id}><Td><span className="flex items-center gap-2"><Avatar user={people(a.id).avatar} size={20} />{a.name}</span></Td><Td>{ROLE_LABEL[a.role]}</Td><Td>{a.credential ?? '-'}</Td>
              <Td>{a.clearance ? <Tag tone="good">Cleared</Tag> : <Tag tone="danger">No clearance</Tag>}{a.note && <div className="text-micro text-muted">{a.note}</div>}</Td><Td className="tnum">{a.activeFrom}</Td></Tr>
          ))}</tbody>
        </Table>
      </Card>
      <Card>
        <div className="border-b border-line px-4 py-2.5"><h2 className="font-display text-title font-bold">Who owns each area</h2>
          <p className="text-micro text-muted">At engagement start: preparer {people(start.preparer).name}, reviewer {people(start.reviewer).name}, partner {people(start.partner).name}.</p></div>
        <Table dense className="rounded-none border-0">
          <thead><tr><Th>Area</Th><Th>Assigned to</Th><Th>Due</Th><Th>Set by</Th></tr></thead>
          <tbody>{AREAS.map((a) => {
            const x = d.assignments.get(a.id)
            return <Tr key={a.id}><Td>{a.label}</Td><Td>{people(x?.assignee ?? start.preparer).name}{!x && <span className="ml-1 text-micro text-faint">(default)</span>}</Td><Td className="tnum">{x?.due ?? '-'}</Td><Td className="text-micro text-muted">{x ? people(x.by).name : ''}</Td></Tr>
          })}</tbody>
        </Table>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          <select value={area} onChange={(e) => setArea(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1 text-meta">{AREAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
          <select value={who} onChange={(e) => setWho(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1 text-meta">{staff.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1 text-meta" />
          <ActionButton size="sm" variant="primary" done="Assigned" actions={{ type: 'assignment.set', refs: [area], payload: { scope: area, assignee: who, due: due || undefined } }}>Assign</ActionButton>
        </div>
      </Card>
    </div>
  )
}
