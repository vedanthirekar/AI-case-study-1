// Records: variance vs last year, prior preparer vs us, tax computation, completeness.
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Th, Tr, Td, TGroup } from '../../components/Table'
import StatusBadge from '../../components/StatusBadge'
import { Tag, Icon } from '../../components/ui'
import { useApp, useDerived, useModel } from '../../state/app'
import { AREAS, areaOf } from '../../lib/packet/areas'
import { fmtValue, fmtSigned } from '../../lib/format'
import { useFindings, evidenceDocs } from '../findings'
import { varianceLines } from '../readiness'
import { docStatus } from '../documents/docStatus'
import { DOC_STATUS, FINDING_STATUS, ADJ_STATUS, SIGNOFF_STATE } from '../vocab'
import { useTrace } from '../trace/useTrace'
import { signoffState } from '../Signoffs'
import { Rec, Block, LV, n0 } from './common'
import { C, schedulesHref } from '../../lib/paths'

/* ---------- Variance vs last year ---------- */

export function Variance() {
  const m = useModel()
  const d = useDerived()
  const { open } = useTrace()
  const std = d.standards.variance_review
  const flagged = new Set(varianceLines(m, std))
  const py = m.packet.prior_years.return_2024
  const keys = Object.keys(py.lines).filter((k) => m.current.lines.has(k))
  return (
    <Rec title="Return summary vs last year" intro={`Every 2024 line next to 2025. Swings over the firm threshold (${std.flag_if_change_over_percent}% and ${n0(std.and_over_amount)}) need an explanation: a note or a verification on the line.`}>
      <Block title={`${keys.length} lines in both years · ${flagged.size} over the threshold`}>
        <Table dense className="rounded-none border-0">
          <thead><tr><Th>Line</Th><Th num>2024</Th><Th num>2025</Th><Th num>Change</Th><Th>Explained</Th></tr></thead>
          <tbody>{keys.map((k) => {
            const cur = m.current.lines.get(k)!.value
            const diff = typeof cur === 'number' ? cur - py.lines[k] : null
            const pct = diff != null && py.lines[k] ? Math.round((diff / Math.abs(py.lines[k])) * 100) : null
            const explained = d.notes.some((n) => n.refs.includes(k)) || d.verifications.has(k)
            return (
              <Tr key={k} onClick={() => open(k)}>
                <Td><div>{py.line_labels[k]}</div><div className="font-mono text-micro text-faint">{k}</div></Td>
                <Td num className="text-muted">{n0(py.lines[k])}</Td><Td num><LV k={k} /></Td>
                <Td num className={flagged.has(k) ? 'font-semibold text-warn' : 'text-muted'}>{diff == null ? '-' : `${fmtSigned(diff).replace('$', '')}${pct != null ? ` (${pct}%)` : ''}`}</Td>
                <Td>{!flagged.has(k) ? <span className="text-micro text-faint">under threshold</span> : explained ? <Tag tone="good"><Icon name="check" size={11} />Explained</Tag> : <Tag tone="warn">Needs a note</Tag>}</Td>
              </Tr>
            )
          })}</tbody>
        </Table>
      </Block>
    </Rec>
  )
}

/* ---------- Prior preparer vs us ---------- */

export function PriorPreparer() {
  const m = useModel()
  const d = useDerived()
  const findings = useFindings()
  const ppw = m.packet.prior_years.prior_preparer_workpaper
  const pyNotes = m.packet.prior_years.return_2024.notes
  const items = findings.filter((f) => f.source === 'prior_preparer')
  return (
    <Rec title="What the prior preparer did vs what we changed" intro={`${m.packet.prior_years.return_2024.prepared_by} prepared 2024 (filed ${m.packet.prior_years.return_2024.filed}). Their memo, their open items and how each stands now, and every change we made.`}>
      <div className="grid gap-4 xl:grid-cols-2">
        <Block title="Their memo and notes">
          <div className="space-y-2 p-4 text-meta">
            <p className="text-ink">{ppw.summary_memo}</p>
            <ul className="list-disc space-y-1 pl-4 text-muted">{ppw.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
        </Block>
        <Block title="Their open items, today">
          <ul>{items.map((f) => (
            <li key={f.id} className="flex items-start gap-2 border-b border-line2 px-4 py-2 text-meta last:border-0">
              <StatusBadge vocab={FINDING_STATUS} value={f.status} />
              <div><div className="font-medium text-ink">{f.title}</div><div className="text-muted">{f.summary}</div></div>
            </li>
          ))}</ul>
        </Block>
      </div>
      <Block title="Treatments that differ from 2024">
        <Table dense className="rounded-none border-0">
          <thead><tr><Th>Line</Th><Th>2024 treatment</Th><Th>2025</Th></tr></thead>
          <tbody>{Object.entries(pyNotes).map(([k, note]) => (
            <Tr key={k}><Td className="font-mono text-micro">{k}</Td><Td className="text-meta">{note}</Td><Td className="text-meta"><LV k={k} /> <span className="text-muted">{m.current.lines.get(k)?.note ?? m.current.lines.get(k)?.label}</span></Td></Tr>
          ))}</tbody>
        </Table>
      </Block>
      <Block title={`Our changes (${d.adjustments.length})`}>
        {d.adjustments.length === 0 ? <p className="px-4 py-4 text-meta text-muted">No adjustments yet.</p> : (
          <Table dense className="rounded-none border-0">
            <thead><tr><Th>Line</Th><Th>Change</Th><Th>Why</Th><Th>Status</Th></tr></thead>
            <tbody>{d.adjustments.map((a) => (
              <Tr key={a.id}><Td className="font-mono text-micro">{a.lineKey}</Td><Td className="tnum">{fmtValue(a.from)} → {fmtValue(a.to)}</Td><Td className="text-micro text-muted">{a.reason}</Td><Td><StatusBadge vocab={ADJ_STATUS} value={a.status} /></Td></Tr>
            ))}</tbody>
          </Table>
        )}
      </Block>
    </Rec>
  )
}

/* ---------- Tax computation ---------- */

const COMP: [string, string[]][] = [
  ['Income', ['F1040.1z', 'F1040.2b', 'F1040.3b', 'F1040.4b', 'F1040.7', 'F1040.8', 'F1040.9', 'F1040.10', 'F1040.11']],
  ['Taxable income', ['F1040.12', 'F1040.13', 'F1040.14', 'F1040.15']],
  ['Tax', ['F1040.16', 'F6251.4', 'F6251.5', 'F6251.9', 'F6251.11', 'F1040.18', 'F1040.19', 'F1040.20', 'F1040.22']],
  ['Other taxes', ['Sch2.4', 'Sch2.11', 'Sch2.12', 'F1040.23', 'F1040.24']],
  ['Payments and balance', ['F1040.25d', 'F1040.26', 'F1040.31', 'F1040.33', 'F1040.37', 'F1040.38']],
]

export function TaxComputation() {
  const m = useModel()
  return (
    <Rec title="Tax computation" intro="From total income to the amount owed, including the alternative minimum tax from the incentive stock option exercise. Every number traces.">
      <Block title="Federal">
        <Table dense className="rounded-none border-0">
          <tbody>{COMP.map(([g, keys]) => [
            <TGroup key={g} colSpan={3}>{g}</TGroup>,
            ...keys.map((k) => { const l = m.current.lines.get(k); return l ? <Tr key={k}><Td>{l.label}</Td><Td className="font-mono text-micro text-faint">{k} · {l.rule}</Td><Td num><LV k={k} /></Td></Tr> : null }),
          ])}</tbody>
        </Table>
      </Block>
    </Rec>
  )
}

/* ---------- Completeness ---------- */

export function Completeness() {
  const m = useModel()
  const d = useDerived()
  const simNow = useApp((s) => s.simNow)
  const findings = useFindings()
  const nav = useNavigate()
  const cited = useMemo(() => evidenceDocs(findings, (id) => m.evs.get(id)?.document_id), [findings, m])
  const st = m.packet.documents.map((x) => docStatus(m, x, simNow, cited))
  const counts = Object.keys(DOC_STATUS).map((k) => [k, st.filter((s) => s.state === k).length] as const).filter(([, n]) => n)
  const outside = [
    { name: 'FinCEN 114 (FBAR) for 2025', why: 'Foreign account maximum over $10,000.', refs: 'F8938.1.max', status: 'Outside engagement: tell the client' },
    { name: 'Form 3520 for 2023', why: 'Inheritance from a foreign person over $100,000 (Swedish account, 09/2023). Prior preparer left it open.', refs: 'D36', status: 'Possible late filing: raise with client' },
    { name: 'Forms 1099-NEC for 2025 contractors', why: 'Two contractors paid 600 or more; none issued (D27).', refs: 'SchC.J', status: 'Late; outside engagement' },
    { name: "Ada's own 2025 return", why: 'Summer job W-2 4,100; must check "can be claimed as a dependent".', refs: 'household:ada', status: 'Prepared by Ada; consistent' },
    { name: 'Oregon composite (Woodworks) and Arizona composite (Ridgeline)', why: 'Filed by the entities for nonresident owners; no individual filing required.', refs: 'D39', status: 'No action' },
    { name: 'Form 5329 (excess SEP contribution)', why: 'If the 2,786 excess is not withdrawn by the extended due date.', refs: 'Sch1.16', status: 'Depends on client' },
    { name: 'Form 8801 for 2026', why: 'Minimum tax credit from the 2025 ISO AMT.', refs: 'F6251.11', status: 'Next year' },
  ]
  return (
    <Rec title="Completeness" intro="Proof that nothing was missed: every document used or explained, every area considered and signed, every outside filing identified.">
      <Block title={`Every document (${m.packet.documents.length})`} right={<button onClick={() => nav(C('/documents'))} className="text-micro font-semibold text-accent hover:underline">Open documents</button>}>
        <div className="flex flex-wrap gap-2 p-4">{counts.map(([k, n]) => <StatusBadge key={k} vocab={DOC_STATUS} value={k} suffix={n} />)}</div>
      </Block>
      <Block title="Every area">
        <Table dense className="rounded-none border-0">
          <thead><tr><Th>Area</Th><Th num>Lines</Th><Th num>Open findings</Th><Th>Preparer</Th><Th>Reviewer</Th><Th>Partner</Th></tr></thead>
          <tbody>{AREAS.map((a) => {
            const s = signoffState(m, d, a.id)
            return (
              <Tr key={a.id} onClick={() => nav(schedulesHref(`?area=${a.id}`))}>
                <Td>{a.label}</Td><Td num>{m.current.order.filter((k) => areaOf(k) === a.id).length}</Td>
                <Td num>{findings.filter((f) => f.area === a.id && f.status === 'open').length || <span className="text-faint">0</span>}</Td>
                {s.levels.map((l) => <Td key={l.level}><StatusBadge vocab={SIGNOFF_STATE} value={l.state} /></Td>)}
              </Tr>
            )
          })}</tbody>
        </Table>
      </Block>
      <Block title="Every outside filing">
        <Table dense className="rounded-none border-0">
          <thead><tr><Th>Filing</Th><Th>Why it applies</Th><Th>Status</Th></tr></thead>
          <tbody>{outside.map((o) => <Tr key={o.name}><Td className="font-medium">{o.name}</Td><Td className="text-micro text-muted">{o.why}</Td><Td className="text-micro">{o.status}</Td></Tr>)}</tbody>
        </Table>
      </Block>
    </Rec>
  )
}
