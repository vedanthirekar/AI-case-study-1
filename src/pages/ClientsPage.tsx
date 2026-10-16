// The firm's home: its clients. One household in this packet; open it to work the return.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShell } from '../components/shell/ShellContext'
import PageHeader from '../components/shell/PageHeader'
import { Table, Th, Tr, Td } from '../components/Table'
import { Avatar, Btn, Card, Icon, Tag } from '../components/ui'
import { useApp, useDerived, useModel } from '../state/app'
import { fmtDate, fmtMoney } from '../lib/format'
import { C } from '../lib/paths'
import { useFindings, isOpenIssue } from '../features/findings'
import { readiness } from '../features/readiness'
import { usePeople } from '../features/people'
import { useLoadDemo } from '../features/shell/TopBar'

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
  const open = findings.filter(isOpenIssue)
  const sum = m.current.v.summary
  const fed = Math.round(sum.federal.balance_due + d.totalEffect.fedBalance)
  const a = m.packet.firm.assignment_at_start
  const due = m.packet.firm.deadlines.filter((x) => x.date >= simNow.slice(0, 10)).sort((x, y) => x.date.localeCompare(y.date))[0]
  // The return is due April 15 until the extension (Form 4868 / FTB 3519) is on the timeline.
  const ext = m.timeline.find((t) => t.event === 'extension_filed_with_payment' && t.at <= simNow)
  const returnDue = m.packet.firm.deadlines.find((x) => (ext ? /extended due date/i : /original due date/i).test(x.what))?.date
  const status = d.filing.amending ? 'Amending' : d.filing.frozen ? 'Filed' : d.filing.clientApproval ? 'Client approved' : open.length ? 'In review' : 'Ready'
  const names = m.packet.household.people.filter((p) => p.role !== 'dependent').map((p) => p.name)

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-6 py-6">
      <PageHeader eyebrow={m.packet.firm.name} icon="users" title="Clients" subtitle={`Tax season ${m.taxYear} · ${fmtDate(simNow)}`} />
      <StartHere onOpen={() => nav(C())} />
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
              <Td className="text-micro">{returnDue ? fmtDate(returnDue) : '-'}{ext && <div className="text-faint">extended</div>}</Td>
            </Tr>
          </tbody>
        </Table>
      </Card>
      
    </div>
  )
}

const HIDE_KEY = 'miraflores-workpaper:start-here-hidden'

/** For a first-time visitor: what this is and a five-minute path through it. Hiding it is remembered per browser. */
function StartHere({ onOpen }: { onOpen: () => void }) {
  const loadDemo = useLoadDemo()
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(HIDE_KEY) === '1' } catch { return false } })
  if (hidden) return null
  const hide = () => { setHidden(true); try { localStorage.setItem(HIDE_KEY, '1') } catch { /* private mode: hidden for this visit */ } }
  const steps: [string, string, string][] = [
    ['play', 'Load the mid-season demo', 'A week of review work, with you as Daniel the reviewer. Or start from the packet as delivered.'],
    ['route', 'Open the client file', 'The return map shows where each problem lands. Hover an issue; click any box to trace that number to the exact field on its source document.'],
    ['users', 'Switch roles (top right)', 'Act as preparer, reviewer, partner, a new hire without data clearance, or the client. Controls you cannot use stay visible and say why.'],
    ['clock', 'Move the season clock', 'Replay the season: late and corrected documents, the e-file rejection, payments and a notice.'],
    ['sparkle', 'Ask Mira', 'An AI assistant that answers from this file and cites its sources. It runs on a free model, so answers can take a little while.'],
  ]
  return (
    <Card className="border-accent/30 bg-accent-soft/30 p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-title font-bold">Trying this out? Start here</h2>
          <p className="text-meta text-muted">A working tax workpaper for one household's 2025 return, built from the packet as delivered. Everything you do is saved in this browser, and other tabs update live.</p>
        </div>
        <button onClick={hide} aria-label="Hide" className="text-faint hover:text-ink"><Icon name="x" size={16} /></button>
      </div>
      <ol className="mt-3 grid gap-2 md:grid-cols-5">
        {steps.map(([icon, title, body], i) => (
          <li key={title} className="rounded-lg border border-line2 bg-surface p-2.5">
            <div className="flex items-center gap-1.5 text-meta font-semibold text-ink"><span className="tnum text-micro text-faint">{i + 1}</span><Icon name={icon} size={14} className="text-accent" />{title}</div>
            <p className="mt-1 text-micro text-muted">{body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn size="sm" variant="primary" onClick={() => { void loadDemo().then(onOpen) }}><Icon name="play" size={13} />Load the demo and open the file</Btn>
        <Btn size="sm" onClick={onOpen}><Icon name="arrow-right" size={13} />Open the file as delivered</Btn>
      </div>
    </Card>
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
