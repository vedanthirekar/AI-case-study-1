// Filing and after: gates, client approval and e-file signature, filing with a
// freeze, e-file results, the extension, amendments on top of the frozen return,
// notices, the client's copy, and next year.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useShell } from '../components/shell/ShellContext'
import PageHeader from '../components/shell/PageHeader'
import { Table, Th, Tr, Td, TGroup } from '../components/Table'
import StatusBadge from '../components/StatusBadge'
import { Btn, Card, Icon, Tag, cx } from '../components/ui'
import { useApp, useActor, useDerived, useModel } from '../state/app'
import { effectiveValue } from '../lib/workpaper/derive'
import { num, evByField, docsOfType } from '../lib/packet/model'
import { fmtDate, fmtDateTime, fmtMoney, fmtSigned, fmtValue } from '../lib/format'
import type { Action } from '../lib/workpaper/events'
import { useFindings } from '../features/findings'
import { readiness } from '../features/readiness'
import SignoffBar, { useSignoffs } from '../features/Signoffs'
import { ActionButton } from '../features/ActionButton'
import { ThreadList } from '../features/Threads'
import { RefChip } from '../features/RefChip'
import { FINDING_STATUS } from '../features/vocab'
import { usePeople } from '../features/people'
import { LV } from '../features/areas/common'
import { Attachments } from '../features/Attachments'
import { filingHref, reviewHref } from '../lib/paths'

/** Federal and California totals as the workpaper stands (engine + estimated adjustments). */
export function useFinalFigures() {
  const m = useModel()
  const d = useDerived()
  const f = m.current.v.summary.federal
  const c = m.current.v.summary.california
  const e = d.totalEffect
  return {
    fedTax: Math.round(f.total_tax + e.fedTax), fedPayments: Math.round(f.payments + e.fedTax - e.fedBalance), fedBalance: Math.round(f.balance_due + e.fedBalance),
    caTax: Math.round(c.total_tax + e.caTax), caPayments: Math.round(c.payments + e.caTax - e.caBalance), caBalance: Math.round(c.balance_due + e.caBalance),
    agi: f.agi, caAgi: c.ca_agi,
  }
}

export default function FilingPage() {
  const m = useModel()
  const d = useDerived()
  const simNow = useApp((s) => s.simNow)
  const findings = useFindings()
  const people = usePeople()
  const nav = useNavigate()
  const { publish } = useShell()
  const { hash, snapshot } = useSignoffs('return')
  const fig = useFinalFigures()
  useEffect(() => { publish({ crumbs: [{ label: 'Filing' }] }) }, [publish])

  const steps = useMemo(() => readiness(m, d, findings, simNow), [m, d, findings, simNow])
  const approval = d.filing.clientApproval
  const approvalCurrent = approval?.payload.hash === hash
  const efile = m.packet.tax_agency_records.efile.filter((x) => x.date <= simNow)
  const scripted = m.timeline.filter((t) => t.at <= simNow && /approved|efile|paid|refund|extension|notice/.test(t.event))
  const notices = m.packet.tax_agency_records.notices.filter((n) => n.dated <= simNow.slice(0, 10))
  const ext = m.packet.what_if.extension as { federal: { paid_with_form_4868: number; estimated_balance: number }; california: { paid_with_ftb_3519: number }; based_on_version: string; computed_at: string }
  const ssnFinding = findings.find((f) => f.id.startsWith('dependent-ssn'))
  const fileActions: Action[] = [
    { type: 'filing.recorded', refs: ['return'], payload: { kind: 'submitted', jurisdiction: 'both', hash, snapshot, detail: 'Form 1040 and 540NR transmitted' } },
    { type: 'filing.recorded', refs: ['return'], payload: { kind: 'frozen', hash, snapshot, detail: 'Frozen at filing' } },
  ]
  const status = d.filing.amending ? 'Amending a filed return' : d.filing.frozen ? 'Filed and frozen' : approvalCurrent ? 'Approved by the client: ready to file' : 'In preparation'

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-6 py-6">
      <PageHeader eyebrow="Filing and after" icon="send" title="Filing" subtitle={`${status} · season clock ${fmtDate(simNow)}`}
        actions={<><Btn size="sm" onClick={() => nav(filingHref('/client-copy'))}><Icon name="doc" size={13} />Client copy</Btn><Btn size="sm" onClick={() => nav(filingHref('/next-year'))}><Icon name="arrow-right" size={13} />Next year</Btn></>} />

      <SignoffBar scope="return" label="Whole return" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-line px-4 py-2.5"><h2 className="font-display text-title font-bold">Gates before filing</h2></div>
          <ul>{steps.map((s) => (
            <li key={s.name} className="flex items-start gap-2.5 border-b border-line2 px-4 py-1.5 text-meta last:border-0">
              <Icon name={s.name.startsWith('Client approval') ? (approvalCurrent ? 'check' : 'x') : s.done ? 'check' : 'x'} size={14} className={cx('mt-0.5', (s.name.startsWith('Client approval') ? approvalCurrent : s.done) ? 'text-good' : 'text-danger')} />
              <div><div className="text-ink">{s.name}</div><div className="text-micro text-muted">{s.name.startsWith('Client approval') ? (approvalCurrent ? `Signed by ${people(approval!.actor).name}` : approval ? 'Approval is stale: the return changed after the client signed.' : s.detail) : s.detail}</div></div>
            </li>
          ))}
            {d.notes.filter((n) => n.blocking && !n.resolved).map((n) => (
              <li key={n.id} className="flex items-start gap-2.5 border-t border-line2 bg-danger-soft/40 px-4 py-1.5 text-meta"><Icon name="lock" size={14} className="mt-0.5 text-danger" /><div>Blocking review note on <span className="font-mono">{n.refs[0]}</span>: {n.text}</div></li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="font-display text-title font-bold">The return to file</h2>
            <div className="mt-2 grid grid-cols-2 gap-3 text-meta">
              <Fig label="Federal total tax" v={fig.fedTax} /><Fig label={fig.fedBalance >= 0 ? 'Federal balance due' : 'Federal refund'} v={Math.abs(fig.fedBalance)} />
              <Fig label="California total tax" v={fig.caTax} /><Fig label={fig.caBalance >= 0 ? 'California balance due' : 'California refund'} v={Math.abs(fig.caBalance)} />
            </div>
            <p className="mt-2 text-micro text-faint">Engine {m.current.v.version} plus estimated adjustments. Return fingerprint <span className="font-mono">#{hash}</span>.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!d.filing.frozen || d.filing.amending ? (
                <ActionButton variant="primary" done={d.filing.amending ? 'Amended return filed and frozen' : 'Return filed and frozen'} body="Changes now require an amendment." actions={fileActions}>
                  <Icon name="send" size={13} />{d.filing.amending ? 'File the amended return' : 'File and freeze'}
                </ActionButton>
              ) : (
                <ActionButton done="Amendment opened" body="Changes are recorded as amendments on top of the filed return."
                  actions={{ type: 'filing.recorded', refs: ['return'], payload: { kind: 'amendment_started', detail: 'Amendment opened on the filed return' } }}>
                  <Icon name="edit" size={13} />Start an amendment
                </ActionButton>
              )}
              {d.filing.frozen && <Tag tone={d.filing.amending ? 'warn' : 'good'}><Icon name="lock" size={11} />{d.filing.amending ? 'Amending' : `Frozen ${fmtDate(d.filing.frozen.simAt)}`}</Tag>}
            </div>
          </Card>

          <Card>
            <div className="border-b border-line px-4 py-2.5"><h2 className="font-display text-title font-bold">Client approval and e-file signature</h2></div>
            <div className="space-y-2 p-4 text-meta">
              {approval ? (
                <div className={cx('rounded-lg border p-2.5', approvalCurrent ? 'border-good/40 bg-good-soft/40' : 'border-ai/40 bg-ai-soft/40')}>
                  {approvalCurrent ? <b>Approved and signed (Form 8879 and FTB 8879)</b> : <b>Approval reopened: the return changed after the client signed</b>}
                  <div className="text-muted">{people(approval.actor).name} · {fmtDateTime(approval.at)} · fingerprint #{approval.payload.hash}</div>
                </div>
              ) : <p className="text-muted">Not yet approved. Switch to a client user (Ngozi or Erik) to approve and sign in the client portal.</p>}
              {scripted.filter((t) => t.event === 'client_approved_and_signed_8879').map((t) => <p key={t.id} className="text-micro text-muted">Season record: {t.detail}</p>)}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <div className="border-b border-line px-4 py-2.5"><h2 className="font-display text-title font-bold">E-file and agency record</h2></div>
        {efile.length === 0 && scripted.length === 0 ? <p className="px-4 py-4 text-meta text-muted">Nothing transmitted yet on the season clock. Move the clock past July 13, 2026 to replay the e-file.</p> : (
          <Table dense className="rounded-none border-0">
            <thead><tr><Th>When</Th><Th>What</Th><Th>Detail</Th></tr></thead>
            <tbody>
              <Tr><Td className="tnum">{fmtDate(ext.computed_at)}</Td><Td>Extension (Form 4868 and FTB 3519)</Td><Td className="text-micro">Estimated from {ext.based_on_version}: federal balance {fmtMoney(ext.federal.estimated_balance)}, paid {fmtMoney(ext.federal.paid_with_form_4868)} with Form 4868 (rounded up to the next 500); California {fmtMoney(ext.california.paid_with_ftb_3519)}. On the return as <span className="font-mono">Sch3.10</span> <LV k="Sch3.10" />.</Td></Tr>
              {efile.map((x) => (
                <Tr key={x.submission_id}>
                  <Td className="tnum">{fmtDateTime(x.date)}</Td>
                  <Td><span className="capitalize">{x.jurisdiction}</span> e-file <Tag tone={x.status === 'accepted' ? 'good' : x.status === 'rejected' ? 'danger' : 'muted'}>{x.status.replace('_', ' ')}</Tag></Td>
                  <Td className="text-micro">{x.errors?.map((e) => <div key={e.code}><span className="font-mono">{e.code}</span> {e.message}</div>)}
                    {x.status === 'rejected' && ssnFinding && <div className="mt-1 flex items-center gap-1.5">The workpaper had flagged this: <button onClick={() => nav(reviewHref(`?f=${ssnFinding.id}`))} className="font-semibold text-accent hover:underline">{ssnFinding.title}</button> <StatusBadge vocab={FINDING_STATUS} value={ssnFinding.status} /></div>}
                    <span className="text-faint">Submission {x.submission_id}</span></Td>
                </Tr>
              ))}
              {scripted.filter((t) => /paid|refund/.test(t.event)).map((t) => (
                <Tr key={t.id}><Td className="tnum">{fmtDate(t.at)}</Td><Td className="capitalize">{t.event.replace(/_/g, ' ')}</Td><Td className="text-micro">{t.detail}{t.event === 'federal_balance_paid' && <PostFiling balance={fig.fedBalance} paidOn={t.at} />}</Td></Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {d.filing.frozen && <Amendment />}

      <Card>
        <div className="border-b border-line px-4 py-2.5"><h2 className="font-display text-title font-bold">Notices</h2></div>
        {notices.length === 0 ? <p className="px-4 py-4 text-meta text-muted">No notices yet on the season clock.</p> : (
          <ul>{notices.map((n) => (
            <li key={n.id} className="flex items-start gap-3 border-b border-line2 px-4 py-2.5 text-meta last:border-0">
              <Icon name="mail" size={15} className="mt-0.5 text-faint" />
              <div className="min-w-0 flex-1"><div className="font-semibold">{n.agency} {n.type} · tax year {n.tax_year} · dated {fmtDate(n.dated)}</div>
                <div className="text-muted">{n.summary ?? n.items_under_examination?.join(' ')}</div>{n.status && <div className="text-micro text-good">{n.status}</div>}
                {n.response_due && <div className="text-micro text-danger">Response due {fmtDate(n.response_due)}</div>}</div>
              {n.items_under_examination && <Link to={filingHref(`/notice/${n.id}`)} className="shrink-0 text-meta font-semibold text-accent hover:underline">Assemble response</Link>}
            </li>
          ))}</ul>
        )}
      </Card>
    </div>
  )
}

function Fig({ label, v }: { label: string; v: number }) {
  return <div className="rounded-lg border border-line2 p-2.5"><div className="text-micro text-muted">{label}</div><div className="tnum text-title font-semibold">{fmtMoney(v)}</div></div>
}

/** Interest and penalty when a balance is paid after the original due date (the engine does not compute these). */
function PostFiling({ balance, paidOn }: { balance: number; paidOn: string }) {
  const m = useModel()
  const r = m.packet.post_filing_rates as { irs_underpayment_interest_rate_annual: number; irs_failure_to_pay_penalty_per_month: number }
  if (balance <= 0) return <div className="mt-1 text-warn">Our final return shows a refund, so no balance was due: the scripted payment, interest and penalty do not apply.</div>
  const days = Math.round((Date.parse(paidOn) - Date.parse('2026-04-15')) / 86400000)
  const interest = balance * r.irs_underpayment_interest_rate_annual * days / 365
  const ftp = balance * r.irs_failure_to_pay_penalty_per_month * Math.ceil(days / 30)
  return <div className="mt-1">Paid {days} days after April 15: about {fmtMoney(Math.round(interest))} interest and {fmtMoney(Math.round(ftp))} failure-to-pay penalty (estimate; the IRS computes it). An extension extends time to file, not to pay.</div>
}

function Amendment() {
  const m = useModel()
  const d = useDerived()
  const fz = d.filing.frozen!
  const amended = d.adjustments.filter((a) => a.amendment && a.status !== 'rejected')
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="font-display text-title font-bold">Amendment on top of the filed return</h2>
        <span className="text-micro text-muted">Filed version frozen {fmtDate(fz.simAt)} · #{fz.payload.hash}</span>
      </div>
      {amended.length === 0 ? <p className="px-4 py-4 text-meta text-muted">{d.filing.amending ? 'Amendment open. Adjust any line from its trace; changes appear here as Form 1040-X lines.' : 'No amendment. The filed return is frozen; the partner can open an amendment.'}</p> : (
        <Table dense className="rounded-none border-0">
          <thead><tr><Th>Line</Th><Th num>As filed</Th><Th num>Amended</Th><Th num>Change</Th><Th>Why</Th></tr></thead>
          <tbody>{amended.map((a) => (
            <Tr key={a.id}><Td><div>{m.current.lines.get(a.lineKey)?.label ?? a.lineKey}</div><div className="font-mono text-micro text-faint">{a.lineKey}</div></Td>
              <Td num>{fmtValue(fz.payload.snapshot?.[a.lineKey] ?? a.from)}</Td><Td num className="text-accent">{fmtValue(a.to)}</Td>
              <Td num>{typeof a.to === 'number' && typeof a.from === 'number' ? fmtSigned(a.to - a.from).replace('$', '') : ''}</Td><Td className="text-micro text-muted">{a.reason}</Td></Tr>
          ))}</tbody>
        </Table>
      )}
    </Card>
  )
}

/* ---------------- Client portal ---------------- */

export function ClientPortal() {
  const m = useModel()
  const d = useDerived()
  const me = useActor()
  const { publish } = useShell()
  const { hash, snapshot } = useSignoffs('return')
  const fig = useFinalFigures()
  const [pin, setPin] = useState('')
  const [agree, setAgree] = useState(false)
  useEffect(() => { publish({ crumbs: [{ label: 'My 2025 return' }] }) }, [publish])
  const approval = d.filing.clientApproval
  const current = approval?.payload.hash === hash
  const waiting = d.threads.filter((t) => t.to === 'client' && !t.answered).length
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-6 py-6">
      <PageHeader eyebrow="Client portal" icon="user" title={`Hello, ${me.name.split(' ')[0]}`} subtitle="Your 2025 federal and California returns, prepared by Miraflores." />
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4"><div className="text-micro font-bold uppercase tracking-wider text-faint">Federal</div>
          <div className="tnum mt-1 text-display font-semibold">{fmtMoney(Math.abs(fig.fedBalance))}</div><div className="text-meta text-muted">{fig.fedBalance >= 0 ? 'to pay' : 'refund to you'} · total tax {fmtMoney(fig.fedTax)}</div></Card>
        <Card className="p-4"><div className="text-micro font-bold uppercase tracking-wider text-faint">California</div>
          <div className="tnum mt-1 text-display font-semibold">{fmtMoney(Math.abs(fig.caBalance))}</div><div className="text-meta text-muted">{fig.caBalance >= 0 ? 'to pay' : 'refund to you'} · total tax {fmtMoney(fig.caTax)}</div></Card>
      </div>
      <Card className="p-4">
        <h2 className="font-display text-title font-bold">Questions for you {waiting > 0 && <Tag tone="warn">{waiting} waiting</Tag>}</h2>
        <div className="mt-3"><ThreadList filter={(t) => t.to === 'client'} empty="Nothing to answer right now." /></div>
      </Card>
      <Card className="p-4">
        <h2 className="font-display text-title font-bold">Send us a document</h2>
        <p className="mt-1 text-meta text-muted">A statement, receipt or letter your preparer asked for. It is attached to your file as evidence.</p>
        <div className="mt-2"><Attachments refId="client-upload" /></div>
      </Card>
      <Card className="p-4">
        <h2 className="font-display text-title font-bold">Approve and sign</h2>
        {current ? (
          <p className="mt-2 text-body text-good"><Icon name="check" size={14} className="mr-1 inline" />You approved this return and signed the e-file authorization on {fmtDateTime(approval!.at)}.</p>
        ) : (
          <div className="mt-2 space-y-2 text-body">
            {approval && <p className="text-ai">Your earlier approval no longer matches: the return changed since you signed. Please review and sign again.</p>}
            <p className="text-muted">By signing Form 8879 and FTB 8879 you declare you have examined the return and authorize Miraflores to file it electronically. Enter a five-digit PIN of your choice.</p>
            <label className="flex items-center gap-2 text-meta"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I have reviewed the summary and the client copy.</label>
            <div className="flex items-center gap-2">
              <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="PIN" inputMode="numeric"
                className="tnum w-24 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-body" />
              <ActionButton variant="primary" done="Approved and signed" body="Your preparer has been notified."
                disabledReason={!agree ? 'Confirm you reviewed the return.' : pin.length !== 5 ? 'Enter a five-digit PIN.' : null}
                actions={{ type: 'filing.recorded', refs: ['return'], payload: { kind: 'client_approved', hash, snapshot, pin: `***${pin.slice(-2)}`, detail: 'Form 8879 and FTB 8879 signed electronically' } }}>
                <Icon name="edit" size={13} />Approve and sign
              </ActionButton>
            </div>
          </div>
        )}
        <Link to="/portal/copy" className="mt-3 inline-block text-meta font-semibold text-accent hover:underline">View your copy</Link>
      </Card>
      <p className="text-micro text-faint">{m.packet.firm.name} · Questions? Reply above and your preparer will see it immediately.</p>
    </div>
  )
}

/* ---------------- Client copy ---------------- */

export function ClientCopy() {
  const m = useModel()
  const d = useDerived()
  const { publish } = useShell()
  const fig = useFinalFigures()
  const people = usePeople()
  const me = useActor()
  useEffect(() => { publish({ crumbs: [...(me.role === 'client' ? [] : [{ label: 'Filing', to: filingHref() }]), { label: 'Client copy' }] }) }, [publish, me.role])
  const h = m.packet.household
  const firm = m.packet.firm.firm_identity as { address: string; phone: string }
  const signer = m.staff.get(String(m.packet.firm.firm_identity.paid_preparer_signing_returns))
  const lines: [string, string][] = [['F1040.9', 'Total income'], ['F1040.11', 'Adjusted gross income'], ['F1040.12', 'Deductions (itemized)'], ['F1040.15', 'Taxable income'], ['F1040.24', 'Total tax (engine)'], ['F1040.33', 'Total payments (engine)']]
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-6 py-6 print:max-w-none print:p-0">
      <div className="flex justify-end gap-2 print:hidden"><Btn size="sm" onClick={() => window.print()}><Icon name="doc" size={13} />Print or save as PDF</Btn></div>
      <Card className="space-y-4 p-8">
        <div className="flex items-start justify-between border-b border-line pb-3">
          <div><div className="font-display text-display font-bold">2025 Income Tax Returns</div><div className="text-body text-muted">Federal Form 1040 and California Form 540NR · Married filing jointly</div></div>
          <div className="text-right text-meta"><div className="font-semibold">{m.packet.firm.name}</div><div className="text-muted">{firm.address}</div><div className="text-muted">{firm.phone}</div></div>
        </div>
        <div className="text-body"><b>{h.people.filter((p) => p.role !== 'dependent').map((p) => p.name).join(' and ')}</b><div className="text-muted">{h.addresses[h.addresses.length - 1].address}</div>
          <div className="text-muted">Dependents: {h.people.filter((p) => p.role === 'dependent').map((p) => p.name).join(', ')}</div></div>
        <Table dense>
          <tbody>
            <TGroup colSpan={2}>Federal</TGroup>
            {lines.map(([k, l]) => <Tr key={k}><Td>{l}</Td><Td num>{fmtMoney(num({ value: effectiveValue(m, d, k).value ?? 0 } as never))}</Td></Tr>)}
            <Tr><Td className="font-semibold">Total tax after our adjustments (estimate)</Td><Td num className="font-semibold">{fmtMoney(fig.fedTax)}</Td></Tr>
            <Tr><Td className="font-semibold">{fig.fedBalance >= 0 ? 'Amount you owe' : 'Refund'}</Td><Td num className="font-semibold">{fmtMoney(Math.abs(fig.fedBalance))}</Td></Tr>
            <TGroup colSpan={2}>California (part-year resident to July 14, 2025)</TGroup>
            <Tr><Td>California AGI</Td><Td num>{fmtMoney(fig.caAgi)}</Td></Tr>
            <Tr><Td>Total tax</Td><Td num>{fmtMoney(fig.caTax)}</Td></Tr>
            <Tr><Td className="font-semibold">{fig.caBalance >= 0 ? 'Amount you owe' : 'Refund'}</Td><Td num className="font-semibold">{fmtMoney(Math.abs(fig.caBalance))}</Td></Tr>
          </tbody>
        </Table>
        <div className="grid grid-cols-2 gap-4 border-t border-line pt-3 text-meta">
          <div><div className="text-micro font-bold uppercase tracking-wider text-faint">Taxpayer signature</div>{d.filing.clientApproval ? <>Signed electronically by {people(d.filing.clientApproval.actor).name} on {fmtDate(d.filing.clientApproval.at)}</> : 'Not yet signed'}</div>
          <div><div className="text-micro font-bold uppercase tracking-wider text-faint">Paid preparer</div>{signer?.name}, {signer?.credential} · {m.packet.firm.name}</div>
        </div>
        <p className="text-micro text-muted">Keep this copy with your records for at least seven years. Amounts after adjustments are estimates until the final computation.</p>
      </Card>
    </div>
  )
}

/* ---------------- Notice response ---------------- */

export function NoticeResponse() {
  const m = useModel()
  const d = useDerived()
  const { id } = useParams()
  const { publish } = useShell()
  const n = m.packet.tax_agency_records.notices.find((x) => x.id === id)
  useEffect(() => { publish({ crumbs: [{ label: 'Filing', to: filingHref() }, { label: `Response: ${n?.type ?? id}` }] }) }, [publish, n, id])
  if (!n) return <div className="p-6 text-body text-muted">Notice not found.</div>
  const items = n.items_under_examination ?? []
  const nec = docsOfType(m, '1099-NEC').map((x) => ({ doc: x, ev: evByField(m, x.id, 'box1') }))
  const k = docsOfType(m, '1099-K').map((x) => evByField(m, x.id, 'box1a'))[0]
  const detail = docsOfType(m, 'books_transaction_detail')[0]
  const small = detail && evByField(m, detail.id, 'unreported_small')
  const viaCard = detail && evByField(m, detail.id, 'atlas_paywell')
  const books = docsOfType(m, 'books_profit_loss')[0]
  const total = books && evByField(m, books.id, 'total_income')
  const necTotal = nec.reduce((s, x) => s + Number(x.ev?.value ?? 0), 0)
  const relevantAdj = d.adjustments.filter((a) => /^F8283|^SchA\.1[1-4]|^SchC\.1$/.test(a.lineKey))
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-6 py-6">
      <div className="flex justify-end gap-2 print:hidden">
        <ActionButton size="sm" done="Response recorded" actions={{ type: 'filing.recorded', refs: [n.id], payload: { kind: 'notice_response', detail: `Response to ${n.type} assembled` } }}><Icon name="send" size={13} />Record response sent</ActionButton>
        <Btn size="sm" onClick={() => window.print()}><Icon name="doc" size={13} />Print</Btn>
      </div>
      <Card className="space-y-4 p-6">
        <div><div className="text-micro font-bold uppercase tracking-wider text-accent">Response to {n.agency} {n.type}</div>
          <h1 className="font-display text-display font-bold">Tax year {n.tax_year} · Okafor and Lindqvist</h1>
          <p className="text-body text-muted">Letter dated {fmtDate(n.dated)}; response due {n.response_due && fmtDate(n.response_due)}. Every figure below is the one filed, with the documents and the review record behind it. Assembled from the frozen workpaper.</p></div>
        {items.map((it, i) => (
          <section key={i} className="space-y-2 border-t border-line pt-3">
            <h2 className="font-display text-title font-bold">Item {i + 1}. {it}</h2>
            {/8283|[Nn]oncash/.test(it) && (<>
              <Table dense><tbody>
                {['F8283.A1.stock', 'F8283.A1.vehicle', 'SchA.12'].map((k2) => <Tr key={k2}><Td>{m.current.lines.get(k2)?.label}</Td><Td num><LV k={k2} /></Td></Tr>)}
              </tbody></Table>
              <p className="text-meta text-muted">Stock: 200 shares of a publicly traded fund to a donor-advised fund, valued at the high/low average on the transfer date (no qualified appraisal required for publicly traded securities); held since 2019, so long-term capital gain property. Vehicle: the charity sold it; deduction limited to the gross proceeds on Form 1098-C.</p>
              <div className="grid gap-1.5 sm:grid-cols-2">{['D65', 'D66', 'qa-39'].map((r) => <RefChip key={r} id={r} />)}</div>
            </>)}
            {/gross receipts/i.test(it) && total && (<>
              <Table dense><tbody>
                {nec.map((x) => <Tr key={x.doc.id}><Td>1099-NEC {x.doc.issuer || x.doc.title.replace(/^.*- /, '')}</Td><Td num>{fmtMoney(Number(x.ev?.value ?? 0))}</Td></Tr>)}
                <Tr><Td className="font-semibold">Forms 1099-NEC</Td><Td num className="font-semibold">{fmtMoney(necTotal)}</Td></Tr>
                {small && <Tr><Td>Clients who issued no 1099 (books deposit detail)</Td><Td num>{fmtMoney(Number(small.value))}</Td></Tr>}
                <Tr><Td className="font-semibold">Books revenue</Td><Td num className="font-semibold">{fmtMoney(Number(total.value))}</Td></Tr>
                {k && viaCard && <Tr><Td>Form 1099-K {fmtMoney(Number(k.value))}: the same Atlas Outdoor payments, received by card and already inside the 1099-NEC and the deposits</Td><Td num>included</Td></Tr>}
                <Tr><Td className="font-semibold">Gross receipts reported (Schedule C line 1)</Td><Td num className="font-semibold"><LV k="SchC.1" /></Td></Tr>
              </tbody></Table>
              <div className="grid gap-1.5 sm:grid-cols-2">{[...nec.map((x) => x.doc.id), docsOfType(m, '1099-K')[0]?.id, detail?.id, books?.id].filter(Boolean).map((r) => <RefChip key={r} id={r!} />)}</div>
            </>)}
          </section>
        ))}
        {relevantAdj.length > 0 && (
          <section className="border-t border-line pt-3">
            <h2 className="font-display text-title font-bold">Review record</h2>
            <ul className="mt-1 space-y-1 text-meta">{relevantAdj.map((a) => <li key={a.id}><span className="font-mono text-micro">{a.lineKey}</span> {fmtValue(a.from)} → {fmtValue(a.to)}: {a.reason} ({a.status})</li>)}</ul>
          </section>
        )}
      </Card>
    </div>
  )
}

/* ---------------- Next year ---------------- */

export function NextYear() {
  const m = useModel()
  const d = useDerived()
  const findings = useFindings()
  const { publish } = useShell()
  const fig = useFinalFigures()
  useEffect(() => { publish({ crumbs: [{ label: 'Filing', to: filingHref() }, { label: '2026 rollforward' }] }) }, [publish])
  const pr = m.packet.planning_reference_2026 as { federal_estimate_due_dates: string[]; california_estimate_due_dates: string[]; california_installment_percentages: number[]; federal_safe_harbor: string; california_safe_harbor: string; known_2026_changes_for_this_household: string[] }
  const fedQ = Math.ceil((fig.fedTax * 1.1) / 4 / 10) * 10
  const caTotal = Math.round(fig.caTax * 1.1)
  const carry = m.current.v.carryovers_out
  const held = m.current.v.assets.filter((a) => !a.disposed)
  const open = findings.filter((f) => f.status === 'open')
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-6">
      <PageHeader eyebrow="Carry forward" icon="arrow-right" title="2026: what next year's preparer inherits" subtitle="Everything carries forward with its history: carryovers, basis, assets, open items and a payment plan." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><div className="border-b border-line px-4 py-2.5"><h2 className="font-display text-title font-bold">2026 estimated payments</h2></div>
          <div className="space-y-2 p-4 text-meta">
            <p className="text-muted">{pr.federal_safe_harbor}</p>
            <Table dense><tbody>{pr.federal_estimate_due_dates.map((x) => <Tr key={x}><Td>Federal · {fmtDate(x)}</Td><Td num>{fmtMoney(fedQ)}</Td></Tr>)}</tbody></Table>
            <p className="text-muted">{pr.california_safe_harbor}</p>
            <Table dense><tbody>{pr.california_estimate_due_dates.map((x, i) => <Tr key={x}><Td>California · {fmtDate(x)} ({Math.round(pr.california_installment_percentages[i] * 100)}%)</Td><Td num>{fmtMoney(Math.round(caTotal * pr.california_installment_percentages[i]))}</Td></Tr>)}</tbody></Table>
            <p className="text-micro text-faint">Safe harbor at 110% of 2025 tax after adjustments ({fmtMoney(fig.fedTax)} federal, {fmtMoney(fig.caTax)} California). California may be far less: only California-source income is taxed after the move.</p>
          </div>
        </Card>
        <Card><div className="border-b border-line px-4 py-2.5"><h2 className="font-display text-title font-bold">Known changes for 2026</h2></div>
          <ul className="list-disc space-y-1 py-3 pl-8 pr-4 text-meta">{pr.known_2026_changes_for_this_household.map((x) => <li key={x}>{x}</li>)}</ul>
        </Card>
        <Card><div className="border-b border-line px-4 py-2.5"><h2 className="font-display text-title font-bold">Carryovers and basis out</h2></div>
          <Table dense className="rounded-none border-0"><tbody>
            {Object.entries(carry.federal).filter(([, v]) => v).map(([k, v]) => <Tr key={k}><Td className="capitalize">{k.replace(/_/g, ' ')}</Td><Td num>{fmtMoney(Number(v))}</Td></Tr>)}
            <Tr><Td>S corporation stock basis (Woodworks)</Td><Td num>{fmtMoney(Number(carry.federal.scorp_stock_basis_end ?? 0))}</Td></Tr>
          </tbody></Table>
        </Card>
        <Card><div className="border-b border-line px-4 py-2.5"><h2 className="font-display text-title font-bold">Assets carried forward ({held.length})</h2></div>
          <Table dense className="rounded-none border-0"><tbody>
            {held.map((a) => <Tr key={a.asset_id}><Td>{a.description}</Td><Td num className="text-micro">fed accum. {fmtMoney(Math.round(a.federal.accumulated_end ?? 0))}<br />CA accum. {fmtMoney(Math.round(a.california.accumulated_end ?? 0))}</Td></Tr>)}
          </tbody></Table>
        </Card>
      </div>
      <Card><div className="border-b border-line px-4 py-2.5"><h2 className="font-display text-title font-bold">Open items handed forward ({open.length})</h2></div>
        <ul>{open.slice(0, 20).map((f) => <li key={f.id} className="border-b border-line2 px-4 py-1.5 text-meta last:border-0">{f.title}<span className="ml-2 text-micro text-muted">{f.check}</span></li>)}</ul>
        {d.decisions.length > 0 && <div className="border-t border-line px-4 py-2 text-micro text-muted">{d.decisions.length} recorded decisions travel with the file (see Changes).</div>}
      </Card>
    </div>
  )
}
