// Where the return stands: the numbers against last year and with our
// adjustments, what is open by area, the steps to filing, and the deadlines.
import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShell } from '../components/shell/ShellContext'
import PageHeader from '../components/shell/PageHeader'
import { Table, Th, Tr, Td } from '../components/Table'
import { Card, Icon, Tag, cx } from '../components/ui'
import { useApp, useDerived, useModel, useActor } from '../state/app'
import { AREAS } from '../lib/packet/areas'
import { fmtDate, fmtMoney, fmtSigned } from '../lib/format'
import { addEffects, ZERO } from '../lib/workpaper/effect'
import { ROLE_LABEL } from '../lib/rules/rules'
import { useFindings } from '../features/findings'
import { readiness } from '../features/readiness'

export default function Overview() {
  const m = useModel()
  const d = useDerived()
  const actor = useActor()
  const simNow = useApp((s) => s.simNow)
  const findings = useFindings()
  const nav = useNavigate()
  const { publish } = useShell()
  useEffect(() => { publish({ crumbs: [{ label: 'Overview' }] }) }, [publish])

  const v = m.current.v
  const py = m.packet.prior_years.return_2024.lines
  const fed = v.summary.federal
  const ca = v.summary.california
  const e = d.totalEffect
  const open = findings.filter((f) => f.status === 'open')
  const pendingFix = open.filter((f) => f.proposals.length).reduce((acc, f) => addEffects(acc, f.effect), ZERO)
  const steps = useMemo(() => readiness(m, d, findings, simNow), [m, d, findings, simNow])
  const done = steps.filter((s) => s.done).length
  const day = simNow.slice(0, 10)

  const fedRows: [string, number | null, number, number | null][] = [
    ['Adjusted gross income', py['F1040.11'] ?? null, fed.agi, null],
    ['Taxable income', py['F1040.15'] ?? null, fed.taxable_income, null],
    ['Total tax', py['F1040.24'] ?? null, fed.total_tax, fed.total_tax + e.fedTax],
    ['Payments', py['F1040.33'] ?? null, fed.payments, fed.payments + (e.fedTax - e.fedBalance)],
    ['Balance due (refund if negative)', py['F1040.33'] != null ? (py['F1040.24'] ?? 0) - py['F1040.33'] : null, fed.balance_due, fed.balance_due + e.fedBalance],
  ]
  const caRows: [string, number | null, number, number | null][] = [
    ['California AGI', null, ca.ca_agi, null],
    ['Total tax', null, ca.total_tax, ca.total_tax + e.caTax],
    ['Payments', null, ca.payments, ca.payments + (e.caTax - e.caBalance)],
    ['Balance due (refund if negative)', null, ca.balance_due, ca.balance_due + e.caBalance],
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-6 py-6">
      <PageHeader eyebrow={`Okafor-Lindqvist · ${m.taxYear} · married filing jointly`} icon="home" title="Where the return stands"
        subtitle={`Season clock ${fmtDate(simNow)} · engine ${v.version} computed ${fmtDate(v.computed_at)} · viewing as ${actor.name} (${ROLE_LABEL[actor.role]})`} />

      {open.length > 0 && (
        <button onClick={() => nav('/review')} className="flex w-full items-center gap-3 rounded-xl2 border border-warn/40 bg-warn-soft/50 p-3 text-left transition hover:border-warn">
          <Icon name="alert" size={18} className="shrink-0 text-warn" />
          <div className="min-w-0 flex-1 text-body">
            <b>{open.length} open findings</b> from independent checks. Accepting the proposed fixes would move federal tax by <b className="tnum">{fmtSigned(pendingFix.fedTax)}</b> and California tax by <b className="tnum">{fmtSigned(pendingFix.caTax)}</b>.
          </div>
          <span className="flex items-center gap-1 text-meta font-semibold text-warn">Review<Icon name="arrow-right" size={14} /></span>
        </button>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryCard title="Federal" rows={fedRows} showLy />
        <SummaryCard title="California (part-year, 540NR)" rows={caRows} />
      </div>
      <p className="-mt-2 text-micro text-faint">"With adjustments" adds the estimated effect of adjustments not rejected ({d.adjustments.filter((a) => a.status !== 'rejected').length}) to engine {v.version}. Income lines do not move until the engine recomputes.</p>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-display text-title font-bold">Steps to filing</h2>
            <Tag tone={done === steps.length ? 'good' : 'muted'}>{done} of {steps.length} done</Tag>
          </div>
          <ul>{steps.map((s, i) => (
            <li key={s.name}>
              <button onClick={() => s.href && nav(s.href)} disabled={!s.href} className="flex w-full items-start gap-3 border-b border-line2 px-4 py-2 text-left transition last:border-0 enabled:hover:bg-slateSoft">
                <span className={cx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-micro', s.done ? 'border-good bg-good-soft text-good' : 'border-line text-faint')}>
                  {s.done ? <Icon name="check" size={12} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1"><span className={cx('block text-body', s.done ? 'text-muted' : 'font-medium text-ink')}>{s.name}</span>
                  <span className="block text-micro text-muted">{s.detail}</span></span>
              </button>
            </li>
          ))}</ul>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="border-b border-line px-4 py-3"><h2 className="font-display text-title font-bold">Deadlines</h2></div>
            <ul>{m.packet.firm.deadlines.map((x) => {
              const days = Math.round((Date.parse(x.date) - Date.parse(day)) / 86400000)
              return (
                <li key={x.what} className="flex items-center gap-3 border-b border-line2 px-4 py-2 last:border-0">
                  <span className="min-w-0 flex-1 text-meta">{x.what}</span>
                  <span className="tnum text-meta">{fmtDate(x.date)}</span>
                  <span className={cx('tnum w-16 text-right text-micro', days < 0 ? 'text-faint' : days < 14 ? 'text-danger' : 'text-muted')}>{days < 0 ? `${-days}d ago` : `in ${days}d`}</span>
                </li>
              )
            })}</ul>
          </Card>
          <Card>
            <div className="border-b border-line px-4 py-3"><h2 className="font-display text-title font-bold">The household</h2></div>
            <div className="space-y-1.5 px-4 py-3 text-meta">
              {m.packet.household.people.map((p) => (
                <div key={p.id} className="flex justify-between gap-2"><span>{p.name}</span><span className="text-muted">{p.role}{p.occupation ? ` · ${p.occupation}` : p.relationship ? ` · ${p.relationship}` : ''}</span></div>
              ))}
              <div className="border-t border-line2 pt-1.5 text-muted">{m.packet.household.residency.map((r) => `${r.state} ${fmtDate(r.from)} to ${fmtDate(r.to)}`).join(' · ')}</div>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <div className="border-b border-line px-4 py-3"><h2 className="font-display text-title font-bold">By area</h2></div>
        <Table dense className="rounded-none border-0">
          <thead><tr><Th>Area</Th><Th num>Open findings</Th><Th num>Adjustments</Th><Th num>Budget hours</Th></tr></thead>
          <tbody>{AREAS.map((a) => {
            const f = open.filter((x) => x.area === a.id).length
            const adj = d.adjustments.filter((x) => x.area === a.id && x.status !== 'rejected').length
            return (
              <Tr key={a.id} onClick={() => nav(`/return?area=${a.id}`)}>
                <Td><span className="flex items-center gap-2"><Icon name={a.icon} size={14} className="text-faint" />{a.label}</span></Td>
                <Td num>{f ? <span className="text-warn">{f}</span> : <span className="text-faint">0</span>}</Td>
                <Td num>{adj || <span className="text-faint">0</span>}</Td>
                <Td num className="text-muted">{a.budgetKey ? m.packet.firm.budget_hours[a.budgetKey] : '-'}</Td>
              </Tr>
            )
          })}</tbody>
        </Table>
      </Card>
    </div>
  )
}

function SummaryCard({ title, rows, showLy = false }: { title: string; rows: [string, number | null, number, number | null][]; showLy?: boolean }) {
  return (
    <Card>
      <div className="border-b border-line px-4 py-3"><h2 className="font-display text-title font-bold">{title}</h2></div>
      <Table dense className="rounded-none border-0">
        <thead><tr><Th /> {showLy && <Th num>2024 filed</Th>}<Th num>Engine</Th><Th num>With adjustments</Th></tr></thead>
        <tbody>{rows.map(([label, ly, v, adj]) => (
          <Tr key={label}>
            <Td>{label}</Td>
            {showLy && <Td num className="text-muted">{ly == null ? '-' : fmtMoney(ly)}</Td>}
            <Td num>{fmtMoney(v)}</Td>
            <Td num>{adj == null ? <span className="text-faint">-</span> : <span className={cx(Math.round(adj) !== Math.round(v) && 'font-semibold text-accent')}>{fmtMoney(Math.round(adj))}</span>}</Td>
          </Tr>
        ))}</tbody>
      </Table>
    </Card>
  )
}
