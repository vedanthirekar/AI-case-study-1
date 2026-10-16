// The firm's home: its clients. One household in this packet; open it to work the return.
import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShell } from '../components/shell/ShellContext'
import PageHeader from '../components/shell/PageHeader'
import { Table, Th, Tr, Td } from '../components/Table'
import { Avatar, Card, Icon, Tag } from '../components/ui'
import { useApp, useDerived, useModel } from '../state/app'
import { fmtDate, fmtMoney } from '../lib/format'
import { C } from '../lib/paths'
import { useFindings } from '../features/findings'
import { readiness } from '../features/readiness'
import { usePeople } from '../features/people'

export default function ClientsPage() {
  const m = useModel()
  const d = useDerived()
  const simNow = useApp((s) => s.simNow)
  const findings = useFindings()
  const people = usePeople()
  const nav = useNavigate()
  const { publish } = useShell()
  useEffect(() => { publish({ crumbs: [{ label: 'Clients' }] }) }, [publish])

  const steps = useMemo(() => readiness(m, d, findings, simNow), [m, d, findings, simNow])
  const open = findings.filter((f) => f.status === 'open')
  const sum = m.current.v.summary
  const fed = Math.round(sum.federal.balance_due + d.totalEffect.fedBalance)
  const a = m.packet.firm.assignment_at_start
  const due = m.packet.firm.deadlines.filter((x) => x.date >= simNow.slice(0, 10)).sort((x, y) => x.date.localeCompare(y.date))[0]
  const days = due ? Math.round((Date.parse(due.date) - Date.parse(simNow.slice(0, 10))) / 86400000) : null
  const status = d.filing.amending ? 'Amending' : d.filing.frozen ? 'Filed' : d.filing.clientApproval ? 'Client approved' : open.length ? 'In review' : 'Ready'
  const names = m.packet.household.people.filter((p) => p.role !== 'dependent').map((p) => p.name)

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-6 py-6">
      <PageHeader eyebrow={m.packet.firm.name} icon="users" title="Clients" subtitle={`Tax season ${m.taxYear} · ${fmtDate(simNow)}`} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Clients" value="1" />
        <Stat label="In review" value={status === 'In review' ? '1' : '0'} />
        <Stat label="Open issues" value={String(open.length)} tone={open.length ? 'text-warn' : 'text-good'} />
        <Stat label="Next deadline" value={due ? fmtDate(due.date) : '-'} sub={due ? `${due.what.slice(0, 48)}` : ''} />
      </div>
      <Card>
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="font-display text-title font-bold">Returns</h2>
          <span className="text-micro text-muted">Click a client to open their file</span>
        </div>
        <Table dense className="rounded-none border-0">
          <thead><tr><Th>Client</Th><Th>Return</Th><Th>Status</Th><Th>Team</Th><Th num>Open issues</Th><Th num>Steps</Th><Th num>Federal (est.)</Th><Th>Due</Th></tr></thead>
          <tbody>
            <Tr onClick={() => nav(C())}>
              <Td><div className="font-semibold text-ink">Okafor-Lindqvist household</div><div className="text-micro text-muted">{names.join(' & ')} · {m.packet.packet.client_id}</div></Td>
              <Td className="text-meta">{m.taxYear} Form 1040 + CA 540NR</Td>
              <Td><Tag tone={status === 'Filed' ? 'good' : status === 'In review' ? 'warn' : 'accent'}>{status}</Tag></Td>
              <Td><div className="flex -space-x-1">{[a.preparer, a.reviewer, a.partner].map((id) => <Avatar key={id} user={people(id).avatar} size={22} ring />)}</div></Td>
              <Td num className={open.length ? 'text-warn' : ''}>{open.length}</Td>
              <Td num>{steps.filter((s) => s.done).length}/{steps.length}</Td>
              <Td num>{fmtMoney(Math.abs(fed))} {fed < 0 ? 'refund' : 'owed'}</Td>
              <Td className="text-micro">{fmtDate('2026-10-15')}{days != null && <div className="text-faint">extended</div>}</Td>
            </Tr>
          </tbody>
        </Table>
      </Card>
      
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <Card className="p-3">
      <div className="text-micro font-bold uppercase tracking-wider text-faint">{label}</div>
      <div className={`tnum mt-1 text-display font-semibold ${tone ?? ''}`}>{value}</div>
      {sub && <div className="truncate text-micro text-muted">{sub}</div>}
    </Card>
  )
}
