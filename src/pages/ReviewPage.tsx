// The reviewer's inbox: what the independent checks found, ranked by tax at
// risk, with the evidence and a proposed fix. Bulk actions are one batch: one Undo.
import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useShell } from '../components/shell/ShellContext'
import Tabs from '../components/Tabs'
import { Table, Th, Tr, Td } from '../components/Table'
import StatusBadge, { StatusLegend } from '../components/StatusBadge'
import { Btn, Icon, Tooltip, Card, Avatar, cx } from '../components/ui'
import { useDerived, useModel } from '../state/app'
import { AREAS, AREA_BY_ID } from '../lib/packet/areas'
import { fmtSigned, fmtValue, fmtDateTime } from '../lib/format'
import { addEffects, ZERO, magnitude } from '../lib/workpaper/effect'
import type { Action } from '../lib/workpaper/events'
import { useFindings, type ReviewedFinding } from '../features/findings'
import { SEVERITY, FINDING_STATUS, ADJ_STATUS } from '../features/vocab'
import { RefChip, QuoteRef } from '../features/RefChip'
import { ActionButton } from '../features/ActionButton'
import { EffectLine } from '../features/trace/TracePanel'
import DocumentViewer from '../features/documents/DocumentViewer'
import { usePeople } from '../features/people'
import { ThreadList, AskForm } from '../features/Threads'

type StatusFilter = 'open' | 'all' | 'done'

const proposalActions = (f: ReviewedFinding): Action[] => f.proposals.map((p) => ({
  type: 'adjustment.proposed', refs: [p.lineKey, `finding:${f.id}`],
  payload: { lineKey: p.lineKey, from: p.from, to: p.to, fed: p.fed, ca: p.ca, reason: p.reason, findingId: f.id },
}))

export default function ReviewPage() {
  const { publish } = useShell()
  const findings = useFindings()
  const d = useDerived()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<'findings' | 'adjustments' | 'questions' | 'notes'>((params.get('tab') as 'adjustments') ?? 'findings')
  const [status, setStatus] = useState<StatusFilter>('open')
  const [area, setArea] = useState('all')
  const [sev, setSev] = useState('all')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [legend, setLegend] = useState(false)
  const [bulkReason, setBulkReason] = useState('')
  const sel = params.get('f')

  useEffect(() => { publish({ crumbs: [{ label: 'Review inbox' }] }) }, [publish])

  const shown = findings.filter((f) =>
    (status === 'all' || (status === 'open' ? f.status === 'open' : f.status !== 'open')) &&
    (area === 'all' || f.area === area) && (sev === 'all' || f.severity === sev))
  const open = findings.filter((f) => f.status === 'open')
  const fixable = open.filter((f) => f.proposals.length)
  const ifAccepted = fixable.reduce((acc, f) => addEffects(acc, f.effect), ZERO)
  const selected = findings.find((f) => f.id === sel)
  const pickedFs = findings.filter((f) => picked.has(f.id))
  const pending = d.adjustments.filter((a) => a.status === 'proposed')

  const choose = (id: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('f', id); return n })
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <div className="flex h-full min-h-0">
      <div className="pane min-w-0 flex-1 overflow-y-auto">
        <div className={cx('mx-auto space-y-4 px-6 py-5', selected ? 'max-w-none' : 'max-w-5xl')}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-meta font-semibold uppercase tracking-wide text-accent">Independent checks · engine {useModel().current.v.version}</div>
              <h1 className="font-display text-display font-bold">Review inbox</h1>
              <p className="text-body text-muted">What our own checks found that the engine did not, ranked by tax at risk. Nothing changes until someone accepts it.</p>
            </div>
            <Tooltip label="What the badges mean" side="bottom-end"><button onClick={() => setLegend((x) => !x)} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:text-ink"><Icon name="help" size={15} /></button></Tooltip>
          </div>
          {legend && <div className="grid gap-3 md:grid-cols-2"><StatusLegend vocab={SEVERITY} title="Severity" columns={1} /><StatusLegend vocab={FINDING_STATUS} title="Status" columns={1} /></div>}

          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Open findings" value={String(open.length)} tone={open.length ? 'warn' : 'good'} />
            <Stat label="Block filing" value={String(open.filter((f) => f.blocksFiling || f.severity === 'error').length)} tone="danger" />
            <Stat label="Federal tax if open fixes accepted" value={fmtSigned(ifAccepted.fedTax)} sub={`balance ${fmtSigned(ifAccepted.fedBalance)}`} />
            <Stat label="California tax if open fixes accepted" value={fmtSigned(ifAccepted.caTax)} sub={`balance ${fmtSigned(ifAccepted.caBalance)}`} />
          </div>

          <Tabs value={tab} onChange={(k) => setTab(k as typeof tab)} items={[
            { key: 'findings', label: 'Findings', icon: 'alert', count: open.length, countTone: 'warn' },
            { key: 'adjustments', label: 'Adjustments to approve', icon: 'edit', count: pending.length },
            { key: 'questions', label: 'Questions', icon: 'chat', count: d.threads.filter((t) => !t.answered).length, countTone: 'warn' },
            { key: 'notes', label: 'Review notes', icon: 'note', count: d.notes.filter((n) => n.blocking && !n.resolved).length, countTone: 'warn' },
          ]} />
          {tab === 'questions' && (
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <ThreadList empty="No questions yet. Ask one from any line's trace (Notes tab) or here." />
              <Card className="p-4"><div className="mb-2 font-display text-title font-bold">Ask a question</div><AskForm refs={[]} compact /></Card>
            </div>
          )}
          {tab === 'notes' && <NotesList />}

          {tab === 'findings' && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Seg value={status} onChange={(v) => setStatus(v as StatusFilter)} items={[['open', 'Open'], ['done', 'Acted on'], ['all', 'All']]} />
                <select value={area} onChange={(e) => setArea(e.target.value)} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-body">
                  <option value="all">All areas</option>{AREAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
                <select value={sev} onChange={(e) => setSev(e.target.value)} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-body">
                  <option value="all">All severities</option>{Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <span className="ml-auto text-meta text-muted">{shown.length} shown</span>
              </div>

              {pickedFs.length > 0 && (
                <Card className="flex flex-wrap items-center gap-2 border-accent/40 bg-accent-soft/40 p-2.5">
                  <span className="text-body font-semibold">{pickedFs.length} selected</span>
                  <ActionButton size="sm" variant="primary" done={`Adjustments proposed for ${pickedFs.filter((f) => f.status === 'open' && f.proposals.length).length} findings`} body="One batch: Undo reverses all of it."
                    disabledReason={!pickedFs.some((f) => f.status === 'open' && f.proposals.length) ? 'None of the selected findings has an open proposal.' : null}
                    actions={pickedFs.filter((f) => f.status === 'open').flatMap(proposalActions)} onDone={() => setPicked(new Set())}>
                    <Icon name="check-double" size={13} />Accept proposed fixes
                  </ActionButton>
                  <input value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} placeholder="Reason to dismiss" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1 text-meta" />
                  <ActionButton size="sm" done={`${pickedFs.length} findings dismissed`} body="One batch: Undo reverses all of it."
                    disabledReason={!bulkReason.trim() ? 'Give a reason to dismiss.' : null}
                    actions={pickedFs.map((f) => ({ type: 'finding.dismissed' as const, refs: [`finding:${f.id}`], payload: { findingId: f.id, reason: bulkReason } }))}
                    onDone={() => { setPicked(new Set()); setBulkReason('') }}>Dismiss</ActionButton>
                  <Btn size="sm" variant="ghost" onClick={() => setPicked(new Set())}>Clear</Btn>
                </Card>
              )}

              <Table dense>
                <thead><tr><Th className="w-8" /><Th className="min-w-[240px]">Finding</Th><Th className="w-36">Severity · status</Th><Th num className="w-24">Federal</Th><Th num className="w-24">California</Th></tr></thead>
                <tbody>
                  {shown.map((f) => (
                    <Tr key={f.id} onClick={() => choose(f.id)} selected={f.id === sel}>
                      <Td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={picked.has(f.id)} onChange={() => toggle(f.id)} aria-label="Select" /></Td>
                      <Td>
                        <div className="font-semibold text-ink">{f.title}</div>
                        <div className="text-micro text-muted">{f.check} · {AREA_BY_ID.get(f.area)?.label}{f.blocksFiling && <span className="ml-1.5 text-danger">· blocks filing</span>}</div>
                      </Td>
                      <Td><div className="flex flex-col items-start gap-1"><StatusBadge vocab={SEVERITY} value={f.severity} /><StatusBadge vocab={FINDING_STATUS} value={f.status} /></div></Td>
                      <Td num><EffectNum n={f.effect.fedTax || f.effect.fedBalance} /></Td>
                      <Td num><EffectNum n={f.effect.caTax || f.effect.caBalance} /></Td>
                    </Tr>
                  ))}
                  {shown.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-body text-muted">Nothing here. {status === 'open' && 'Every finding has been acted on.'}</td></tr>}
                </tbody>
              </Table>
              <p className="text-micro text-faint">Tax effects are estimates: dollars moved times the engine's per-dollar rates at this version. The real system would recompute.</p>
            </>
          )}

          {tab === 'adjustments' && <AdjustmentQueue />}
        </div>
      </div>
      {tab === 'findings' && selected && <FindingDetail f={selected} onClose={() => setParams((p) => { const n = new URLSearchParams(p); n.delete('f'); return n })} />}
    </div>
  )
}

function FindingDetail({ f, onClose }: { f: ReviewedFinding; onClose: () => void }) {
  const m = useModel()
  const d = useDerived()
  const nav = useNavigate()
  const [doc, setDoc] = useState<{ id: string; page: number; ev?: string } | null>(null)
  const [reason, setReason] = useState('')
  const [authority, setAuthority] = useState('')
  const [choice, setChoice] = useState('Keep the engine treatment')
  useEffect(() => { setDoc(null) }, [f.id])
  const adjs = d.adjustments.filter((a) => f.adjustmentIds.includes(a.id))
  const quotes = f.evidence.filter((e) => /^(qa|msg|call)-/.test(e))
  const refs = f.evidence.filter((e) => !/^(qa|msg|call)-/.test(e))
  const evFirst = refs.find((r) => m.evs.has(r))
  const viewer = doc ?? (evFirst ? { id: m.evs.get(evFirst)!.document_id, page: m.evs.get(evFirst)!.page, ev: evFirst } : null)

  return (
    <aside className="pane flex h-full w-[min(560px,48vw)] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface">
      <div className="flex items-start gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5"><StatusBadge vocab={SEVERITY} value={f.severity} /><StatusBadge vocab={FINDING_STATUS} value={f.status} />
            <span className="text-micro text-muted">{f.check}</span></div>
          <h2 className="mt-1 font-display text-title font-bold leading-snug">{f.title}</h2>
        </div>
        <button onClick={onClose} aria-label="Close" className="text-faint hover:text-ink"><Icon name="x" size={16} /></button>
      </div>
      <div className="space-y-4 p-4">
        <p className="text-body text-ink">{f.summary}</p>
        {f.nextStep && <p className="flex items-start gap-1.5 text-meta text-accent"><Icon name="arrow-right" size={13} className="mt-0.5" />{f.nextStep}</p>}
        {magnitude(f.effect) > 0 && <EffectLine fedTax={f.effect.fedTax} caTax={f.effect.caTax} fedBal={f.effect.fedBalance} caBal={f.effect.caBalance} />}

        {f.proposals.length > 0 && (
          <section>
            <Head>Proposed {f.proposals.length > 1 ? `adjustments (${f.proposals.length})` : 'adjustment'}</Head>
            <div className="overflow-hidden rounded-lg border border-line2">
              {f.proposals.map((p) => (
                <button key={p.lineKey} onClick={() => nav(`/return?trace=${encodeURIComponent(p.lineKey)}`)} className="block w-full border-b border-line2 px-3 py-2 text-left text-meta transition last:border-0 hover:bg-slateSoft">
                  <div className="flex items-center gap-2"><span className="font-mono text-micro text-accent">{p.lineKey}</span>
                    <span className="tnum ml-auto">{fmtValue(p.from)} → <b>{fmtValue(p.to)}</b></span></div>
                  <div className="text-muted">{p.reason}</div>
                </button>
              ))}
            </div>
            {f.status === 'open' && (
              <div className="mt-2">
                <ActionButton variant="primary" size="sm" done="Adjustment proposed" body="Approval required before it counts as final." actions={proposalActions(f)}>
                  <Icon name="check" size={13} />Accept: propose {f.proposals.length > 1 ? `${f.proposals.length} adjustments` : 'the adjustment'}
                </ActionButton>
              </div>
            )}
          </section>
        )}

        {adjs.length > 0 && (
          <section>
            <Head>Adjustments made from this finding</Head>
            <ul className="space-y-1.5">{adjs.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-lg border border-line2 px-2.5 py-1.5 text-meta">
                <span className="font-mono text-micro text-accent">{a.lineKey}</span><span className="min-w-0 flex-1 truncate text-muted">{a.reason}</span>
                <StatusBadge vocab={ADJ_STATUS} value={a.status} />
              </li>
            ))}</ul>
          </section>
        )}

        {(quotes.length > 0 || refs.length > 0) && (
          <section>
            <Head>Evidence</Head>
            <div className="space-y-1.5">
              {quotes.map((q) => <QuoteRef key={q} id={q} />)}
              {refs.map((r) => <RefChip key={r} id={r} onOpenDoc={setDoc} />)}
            </div>
          </section>
        )}
        {viewer && (
          <section>
            <Head>Source</Head>
            <DocumentViewer key={`${viewer.id}-${viewer.ev ?? viewer.page}`} docId={viewer.id} page={viewer.page} evId={viewer.ev}
              onSelectEv={(ev) => setDoc({ id: m.evs.get(ev)!.document_id, page: m.evs.get(ev)!.page, ev })} showValues={false} />
          </section>
        )}

        {f.status === 'open' && (
          <section className="space-y-3 border-t border-line pt-3">
            {f.severity === 'judgment' && (
              <div className="space-y-2">
                <Head>Record the decision</Head>
                <select value={choice} onChange={(e) => setChoice(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-body">
                  <option>Keep the engine treatment</option><option>Use the alternative</option><option>Raised with the client</option>
                </select>
                <input value={authority} onChange={(e) => setAuthority(e.target.value)} placeholder="Authority relied on (e.g. Treas. Reg. 1.263(a)-3)"
                  className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-body placeholder:text-faint" />
                <ActionButton size="sm" variant="primary" done="Decision recorded"
                  actions={{ type: 'decision.recorded', refs: [`finding:${f.id}`, ...f.lines.slice(0, 3)], payload: { kind: 'judgment', topic: f.id, choice, authority, rationale: f.title } }}>
                  <Icon name="scale" size={13} />Record decision
                </ActionButton>
              </div>
            )}
            {f.proposals.length === 0 && f.severity !== 'judgment' && (
              <ActionButton size="sm" variant="good" done="Marked as handled"
                actions={{ type: 'verification.recorded', refs: [`finding:${f.id}`], payload: { method: 'confirmed_with_client', note: f.title } }}>
                <Icon name="check" size={13} />Mark handled
              </ActionButton>
            )}
            <div className="flex items-center gap-1.5">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this is not an issue"
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-meta placeholder:text-faint" />
              <ActionButton size="sm" done="Finding dismissed" disabledReason={!reason.trim() ? 'Give a reason to dismiss.' : null}
                actions={{ type: 'finding.dismissed', refs: [`finding:${f.id}`], payload: { findingId: f.id, reason } }} onDone={() => setReason('')}>Dismiss</ActionButton>
            </div>
          </section>
        )}
        {f.status === 'dismissed' && <p className="text-meta text-muted">Dismissed: {d.dismissals.get(f.id)?.reason}</p>}
      </div>
    </aside>
  )
}

function AdjustmentQueue() {
  const d = useDerived()
  const people = usePeople()
  const nav = useNavigate()
  const list = [...d.adjustments].sort((a, b) => (a.status === 'proposed' ? 0 : 1) - (b.status === 'proposed' ? 0 : 1) || magnitude(b.effect) - magnitude(a.effect))
  if (!list.length) return <Card><div className="px-6 py-10 text-center text-body text-muted">No adjustments yet. Accept a finding or adjust a line from its trace.</div></Card>
  return (
    <Table dense>
      <thead><tr><Th>Line</Th><Th>Change and reason</Th><Th num className="w-24">Federal</Th><Th num className="w-24">California</Th><Th className="w-40">Status</Th><Th className="w-44" /></tr></thead>
      <tbody>
        {list.map((a) => {
          const p = people(a.by)
          return (
            <Tr key={a.id}>
              <Td mono><button onClick={() => nav(`/return?trace=${encodeURIComponent(a.lineKey)}`)} className="text-accent hover:underline">{a.lineKey}</button></Td>
              <Td>
                <div className="tnum">{fmtValue(a.from)} → <b>{fmtValue(a.to)}</b></div>
                <div className="text-micro text-muted">{a.reason}</div>
                <div className="mt-0.5 flex items-center gap-1 text-micro text-faint"><Avatar user={p.avatar} size={14} />{p.name} · {fmtDateTime(a.at)}</div>
              </Td>
              <Td num><EffectNum n={a.effect.fedTax || a.effect.fedBalance} /></Td>
              <Td num><EffectNum n={a.effect.caTax || a.effect.caBalance} /></Td>
              <Td><StatusBadge vocab={ADJ_STATUS} value={a.status} />{a.decidedBy && <div className="text-micro text-faint">by {people(a.decidedBy).name}</div>}</Td>
              <Td>
                {a.status === 'proposed' && (
                  <div className="flex gap-1">
                    <ActionButton size="sm" variant="good" side="bottom-end" done="Approved" actions={{ type: 'adjustment.approved', refs: [a.lineKey], payload: { adjustmentId: a.id } }}>Approve</ActionButton>
                    <ActionButton size="sm" variant="danger" side="bottom-end" done="Rejected" actions={{ type: 'adjustment.rejected', refs: [a.lineKey], payload: { adjustmentId: a.id, note: 'Rejected in review' } }}>Reject</ActionButton>
                  </div>
                )}
              </Td>
            </Tr>
          )
        })}
      </tbody>
    </Table>
  )
}

function NotesList() {
  const d = useDerived()
  const people = usePeople()
  const nav = useNavigate()
  const list = [...d.notes].sort((a, b) => Number(!!a.resolved) - Number(!!b.resolved) || Number(b.blocking) - Number(a.blocking))
  if (!list.length) return <Card><div className="px-6 py-10 text-center text-body text-muted">No notes yet. Add one from any line's trace (Notes tab). Blocking review notes stop filing until resolved.</div></Card>
  return (
    <Table dense>
      <thead><tr><Th>On</Th><Th>Note</Th><Th className="w-40">State</Th></tr></thead>
      <tbody>{list.map((n) => (
        <Tr key={n.id} onClick={() => n.refs[0] && nav(`/return?trace=${encodeURIComponent(n.refs[0])}`)}>
          <Td mono>{n.refs[0]}</Td>
          <Td><div className="text-ink">{n.text}</div><div className="text-micro text-muted">{people(n.by).name} · {fmtDateTime(n.at)}{n.resolved && ` · resolved by ${people(n.resolved.by).name}: ${n.resolved.resolution}`}</div></Td>
          <Td>{n.resolved ? <StatusBadge vocab={FINDING_STATUS} value="resolved" /> : n.blocking ? <span className="text-micro font-semibold text-danger">Blocks filing</span> : <span className="text-micro text-muted">Open</span>}</Td>
        </Tr>
      ))}</tbody>
    </Table>
  )
}

function Head({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-micro font-bold uppercase tracking-wider text-faint">{children}</div>
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warn' | 'danger' | 'good' }) {
  return (
    <Card className="p-3">
      <div className="text-micro font-bold uppercase tracking-wider text-faint">{label}</div>
      <div className={cx('tnum mt-1 text-display font-semibold', tone === 'warn' && 'text-warn', tone === 'danger' && 'text-danger', tone === 'good' && 'text-good')}>{value}</div>
      {sub && <div className="tnum text-micro text-muted">{sub}</div>}
    </Card>
  )
}

function EffectNum({ n }: { n: number }) {
  if (!Math.round(n)) return <span className="text-faint">-</span>
  return <span className={cx('tnum', n > 0 ? 'text-danger' : 'text-good')}>{fmtSigned(n)}</span>
}

function Seg({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: [string, string][] }) {
  return (
    <div className="flex rounded-lg border border-line bg-surface p-0.5">
      {items.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} className={cx('rounded-md px-2.5 py-1 text-meta font-semibold transition', value === k ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink')}>{l}</button>
      ))}
    </div>
  )
}
