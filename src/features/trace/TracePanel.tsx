// Trace any number: how it was built, where it came from (down to the exact
// field on the page), how it was verified, what changed, the discussion, and
// what it relates to. Opens beside the content so numbers stay clickable.
import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import Tabs from '../../components/Tabs'
import StatusBadge from '../../components/StatusBadge'
import { Icon, Money, Tag, Avatar, Card, cx } from '../../components/ui'
import { useDerived, useModel } from '../../state/app'
import { effectiveValue } from '../../lib/workpaper/derive'
import { recompute } from '../../lib/checks/recompute'
import { effectOf, CATEGORY_LABEL } from '../../lib/workpaper/effect'
import type { EffectBasis, EffectCategory } from '../../lib/workpaper/events'
import { fmtValue, fmtDateTime, fmtSigned, fmtNum } from '../../lib/format'
import { num } from '../../lib/packet/model'
import { AREA_BY_ID, areaOf } from '../../lib/packet/areas'
import { LINE_STATE, ADJ_STATUS, SEVERITY } from '../vocab'
import { lineState } from '../lineStatus'
import { useFindings, findingsByLine } from '../findings'
import { RefChip, QuoteRef } from '../RefChip'
import { ActionButton } from '../ActionButton'
import { usePeople } from '../people'
import { defaultBasis, CATEGORIES } from '../effectDefaults'
import DocumentViewer from '../documents/DocumentViewer'
import { useTrace } from './useTrace'
import { ThreadList, AskForm } from '../Threads'
import { Attachments } from '../Attachments'

type Tab = 'built' | 'source' | 'review' | 'history' | 'notes' | 'related'

export default function TracePanel({ lineKey }: { lineKey: string }) {
  const m = useModel()
  const d = useDerived()
  const findings = useFindings()
  const byLine = useMemo(() => findingsByLine(findings), [findings])
  const { close } = useTrace()
  const [tab, setTab] = useState<Tab>('built')
  const line = m.current.lines.get(lineKey)
  const pending = (d.adjByLine.get(lineKey) ?? []).length === 0 && !line

  if (!line && pending) {
    return (
      <PanelShell onClose={close} title={lineKey} sub="Not a line in the current return">
        <div className="p-4 text-body text-muted">This line does not exist in engine version {m.current.v.version}. It may be a line an adjustment proposes to add.</div>
      </PanelShell>
    )
  }

  const ev = effectiveValue(m, d, lineKey)
  const state = lineState(lineKey, d, byLine)
  const notes = d.notes.filter((n) => n.refs.includes(lineKey))
  const verifs = d.verifications.get(lineKey) ?? []

  return (
    <PanelShell onClose={close} title={line?.label ?? lineKey}
      sub={<><span className="font-mono">{lineKey}</span>{line && <> · {line.jurisdiction === 'federal' ? 'Federal' : 'California'} · {AREA_BY_ID.get(areaOf(lineKey))?.label}</>}</>}
      right={
        <div className="text-right">
          <div className="text-display font-semibold">{typeof ev.value === 'number' && Number.isInteger(ev.value) && Math.abs(ev.value) >= 1 ? <Money value={ev.value} /> : <span className="tnum text-lead">{fmtValue(ev.value)}</span>}</div>
          {ev.adjusted && <div className="tnum text-micro text-faint line-through">{fmtValue(ev.original)}</div>}
          <div className="mt-1"><StatusBadge vocab={LINE_STATE} value={state} /></div>
        </div>
      }>
      <Tabs variant="fill" value={tab} onChange={(k) => setTab(k as Tab)} items={[
        { key: 'built', label: 'Built', icon: 'route' },
        { key: 'source', label: 'Source', icon: 'doc' },
        { key: 'review', label: 'Review', icon: 'check', count: verifs.length },
        { key: 'history', label: 'History', icon: 'history', count: (d.adjByLine.get(lineKey) ?? []).length },
        { key: 'notes', label: 'Notes', icon: 'note', count: notes.filter((n) => !n.resolved).length, countTone: 'warn' },
        { key: 'related', label: 'Related', icon: 'link' },
      ]} />
      <div className="pane min-h-0 flex-1 overflow-y-auto p-4">
        {(byLine.get(lineKey) ?? []).map((f) => (
          <div key={f.id} className="mb-3 flex items-start gap-2 rounded-lg border border-warn/40 bg-warn-soft/50 p-2.5 text-meta">
            <Icon name="alert" size={14} className="mt-0.5 shrink-0 text-warn" />
            <div className="min-w-0"><div className="font-semibold text-ink">{f.title}</div><div className="text-muted">{f.summary}</div></div>
          </div>
        ))}
        {tab === 'built' && <Built lineKey={lineKey} onSource={() => setTab('source')} />}
        {tab === 'source' && <Source lineKey={lineKey} />}
        {tab === 'review' && <Review lineKey={lineKey} />}
        {tab === 'history' && <History lineKey={lineKey} />}
        {tab === 'notes' && <Notes lineKey={lineKey} />}
        {tab === 'related' && <Related lineKey={lineKey} />}
      </div>
    </PanelShell>
  )
}

function PanelShell({ title, sub, right, onClose, children }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <aside className="flex h-full w-[min(520px,46vw)] shrink-0 flex-col border-l border-line bg-surface">
      <div className="flex shrink-0 items-start gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-micro font-bold uppercase tracking-wider text-accent">Trace</div>
          <h2 className="mt-0.5 font-display text-title font-bold leading-snug">{title}</h2>
          {sub && <div className="mt-0.5 truncate text-micro text-muted">{sub}</div>}
        </div>
        {right}
        <button onClick={onClose} aria-label="Close trace" className="text-faint transition hover:text-ink"><Icon name="x" size={16} /></button>
      </div>
      {children}
    </aside>
  )
}

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="mb-4">
      <div className="mb-1.5 flex items-center justify-between text-micro font-bold uppercase tracking-wider text-faint"><span>{title}</span>{right}</div>
      {children}
    </section>
  )
}

/* ---------------- Built ---------------- */

function Built({ lineKey, onSource }: { lineKey: string; onSource: () => void }) {
  const m = useModel()
  const line = m.current.lines.get(lineKey)
  const [, setParams] = useSearchParams()
  if (!line) return null
  const rc = recompute(m, lineKey)
  const usedBy = m.current.usedBy.get(lineKey) ?? []
  const openEv = (id: string) => { setParams((p) => { const n = new URLSearchParams(p); n.set('ev', id); return n }); onSource() }
  return (
    <>
      <Section title="Rule">
        <Card className="p-3">
          <div className="flex items-center gap-2"><span className="font-mono text-micro text-accent">{line.rule}</span>
            {rc.ok === true && <Tag tone="good"><Icon name="check" size={11} />Recomputed: ties</Tag>}
            {rc.ok === false && <Tag tone="danger"><Icon name="alert" size={11} />Does not recompute</Tag>}
          </div>
          <p className="mt-1 text-body text-ink">{m.packet.engine_reference.rules[line.rule] ?? 'Rule text not in the packet.'}</p>
          <p className="mt-1 text-micro text-muted">{rc.detail}</p>
          {line.note && <p className="mt-2 border-t border-line2 pt-2 text-meta text-muted"><b className="text-ink">Engine note:</b> {line.note}</p>}
        </Card>
      </Section>
      {line.inputs.length > 0 && (
        <Section title={`Built from ${line.inputs.length} line${line.inputs.length > 1 ? 's' : ''}`}>
          <div className="rounded-lg border border-line2">{line.inputs.map((k) => <TreeNode key={k} k={k} depth={0} seen={new Set([lineKey])} openEv={openEv} />)}</div>
        </Section>
      )}
      {line.sources.length > 0 && (
        <Section title="Sources">
          <div className="space-y-1.5">{line.sources.map((s) => (
            <RefChip key={s} id={s} onOpenDoc={(x) => (x.ev ? openEv(x.ev) : onSource())} />
          ))}</div>
        </Section>
      )}
      {usedBy.length > 0 && (
        <Section title={`Feeds ${usedBy.length} line${usedBy.length > 1 ? 's' : ''}`}>
          <div className="space-y-1.5">{usedBy.map((k) => <RefChip key={k} id={k} compact />)}</div>
        </Section>
      )}
    </>
  )
}

function TreeNode({ k, depth, seen, openEv }: { k: string; depth: number; seen: Set<string>; openEv: (id: string) => void }) {
  const m = useModel()
  const d = useDerived()
  const { open } = useTrace()
  const [expanded, setExpanded] = useState(depth < 1)
  const l = m.current.lines.get(k)
  if (!l) return null
  const kids = l.inputs.filter((x) => !seen.has(x))
  const has = kids.length > 0 || l.sources.length > 0
  const ev = effectiveValue(m, d, k)
  return (
    <div className={cx(depth > 0 && 'border-l border-line2', 'ml-0')} style={{ marginLeft: depth ? 12 : 0 }}>
      <div className="flex items-center gap-1.5 border-b border-line2 px-2 py-1.5 last:border-0">
        <button onClick={() => setExpanded((x) => !x)} disabled={!has} aria-label={expanded ? 'Collapse' : 'Expand'}
          className="grid h-4 w-4 place-items-center text-faint disabled:opacity-0">
          <Icon name={expanded ? 'chevron-down' : 'chevron'} size={12} />
        </button>
        <button onClick={() => open(k)} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-meta text-ink hover:text-accent">{l.label}</span>
          <span className="font-mono text-micro text-faint">{k} · {l.rule}</span>
        </button>
        <span className="tnum shrink-0 text-meta">{fmtValue(ev.value)}</span>
      </div>
      {expanded && has && (
        <div className="pb-1">
          {kids.map((x) => <TreeNode key={x} k={x} depth={depth + 1} seen={new Set([...seen, k])} openEv={openEv} />)}
          {l.sources.length > 0 && (
            <div className="space-y-1 py-1 pl-6 pr-2">
              {l.sources.slice(0, 8).map((s) => <RefChip key={s} id={s} compact onOpenDoc={(x) => x.ev && openEv(x.ev)} />)}
              {l.sources.length > 8 && <div className="text-micro text-faint">+{l.sources.length - 8} more sources</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------- Source ---------------- */

/** Document values a line rests on: its own sources, or its inputs' sources further down. */
function leafEvs(m: ReturnType<typeof useModel>, key: string, depth = 0, seen = new Set<string>()): string[] {
  const l = m.current.lines.get(key)
  if (!l || seen.has(key) || depth > 8) return []
  seen.add(key)
  const own = l.sources.filter((s) => m.evs.has(s))
  return [...own, ...l.inputs.flatMap((k) => leafEvs(m, k, depth + 1, seen))]
}

function Source({ lineKey }: { lineKey: string }) {
  const m = useModel()
  const [params, setParams] = useSearchParams()
  const line = m.current.lines.get(lineKey)
  const direct = line?.sources.filter((s) => m.evs.has(s)) ?? []
  const leaves = useMemo(() => [...new Set(leafEvs(m, lineKey))], [m, lineKey])
  const list = direct.length ? direct : leaves
  const evId = params.get('ev') && list.includes(params.get('ev')!) ? params.get('ev')! : list[0]
  const ev = evId ? m.evs.get(evId) : undefined
  const other = line?.sources.filter((s) => !m.evs.has(s)) ?? []
  const select = (id: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('ev', id); return n })

  return (
    <>
      {!direct.length && leaves.length > 0 && (
        <p className="mb-2 text-meta text-muted">This number is computed. It rests on {leaves.length} document value{leaves.length > 1 ? 's' : ''} further down; pick one to see exactly where it was read.</p>
      )}
      {list.length > 0 && (
        <Section title={`Document values (${list.length})`}>
          <div className="max-h-44 space-y-1 overflow-auto pr-1">
            {list.slice(0, 60).map((id) => {
              const e = m.evs.get(id)!
              return (
                <button key={id} onClick={() => select(id)}
                  className={cx('flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-meta transition',
                    id === evId ? 'border-accent/60 bg-accent-soft/60' : 'border-line2 hover:bg-slateSoft')}>
                  <Icon name="doc" size={13} className="text-faint" />
                  <span className="min-w-0 flex-1 truncate">{e.label}<span className="ml-1.5 text-faint">{e.document_id} p{e.page}</span></span>
                  <span className="tnum">{fmtValue(e.value)}</span>
                </button>
              )
            })}
          </div>
        </Section>
      )}
      {ev && (
        <Section title="Where it was read">
          <DocumentViewer docId={ev.document_id} evId={ev.id} onSelectEv={select} />
        </Section>
      )}
      {other.length > 0 && (
        <Section title="Other evidence">
          <div className="space-y-1.5">{other.map((s) => /^(qa|msg|call)-/.test(s) ? <QuoteRef key={s} id={s} /> : <RefChip key={s} id={s} />)}</div>
        </Section>
      )}
      {!list.length && !other.length && <p className="text-body text-muted">No document source: the engine computed this from rules and parameters only.</p>}
    </>
  )
}

/* ---------------- Review: verify and adjust ---------------- */

function Review({ lineKey }: { lineKey: string }) {
  const m = useModel()
  const d = useDerived()
  const people = usePeople()
  void m
  const types = d.standards.verification_types
  const [method, setMethod] = useState(types[0])
  const [note, setNote] = useState('')
  const verifs = d.verifications.get(lineKey) ?? []
  return (
    <>
      <Section title="Verified">
        {verifs.length === 0 ? <p className="text-meta text-muted">Nobody has verified this line yet.</p> : (
          <ul className="space-y-1.5">{verifs.map((v) => {
            const p = people(v.by)
            return (
              <li key={v.id + v.ref} className="flex items-start gap-2 rounded-lg border border-good/30 bg-good-soft/40 px-2.5 py-2 text-meta">
                <Avatar user={p.avatar} size={22} />
                <div className="min-w-0 flex-1"><div><b>{p.name}</b> · {v.method.replace(/_/g, ' ')}</div>
                  {v.note && <div className="text-muted">{v.note}</div>}
                  <div className="text-micro text-faint">{fmtDateTime(v.at)}</div></div>
              </li>
            )
          })}</ul>
        )}
      </Section>
      <Section title="Record how you verified it">
        <div className="space-y-2">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-body">
            {types.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you checked (optional)"
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-body placeholder:text-faint" />
          <ActionButton variant="good" size="sm" done="Verification recorded"
            actions={{ type: 'verification.recorded', refs: [lineKey], payload: { method, note: note || undefined } }}
            onDone={() => setNote('')}>
            <Icon name="check" size={13} />Record verification
          </ActionButton>
        </div>
      </Section>
      <AdjustForm lineKey={lineKey} />
    </>
  )
}

export function AdjustForm({ lineKey }: { lineKey: string }) {
  const m = useModel()
  const d = useDerived()
  const cur = effectiveValue(m, d, lineKey)
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [override, setOverride] = useState<{ fed?: EffectCategory; ca?: EffectCategory }>({})
  const target = Number(to.replace(/,/g, ''))
  const valid = to.trim() !== '' && Number.isFinite(target)
  const delta = valid ? target - num({ value: cur.value } as never) : 0
  const base = defaultBasis(lineKey, delta)
  const fed: EffectBasis = override.fed ? { category: override.fed, amount: delta } : base.fed
  const ca: EffectBasis = override.ca ? { category: override.ca, amount: delta } : base.ca
  const eff = effectOf({ fed, ca }, m.current.v.tax_effect_rates)
  if (typeof cur.value === 'string') return null
  return (
    <Section title="Adjust this line">
      <div className="space-y-2 rounded-lg border border-line2 p-3">
        <div className="flex items-center gap-2 text-meta">
          <span className="text-muted">From</span><span className="tnum">{fmtValue(cur.value)}</span><span className="text-muted">to</span>
          <input value={to} onChange={(e) => setTo(e.target.value)} inputMode="decimal" placeholder="new value"
            className="tnum w-32 rounded-lg border border-line bg-surface px-2 py-1 text-body" />
          {valid && <span className="tnum text-muted">({fmtSigned(delta)})</span>}
        </div>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why (required)"
          className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-body placeholder:text-faint" />
        <div className="grid grid-cols-2 gap-2 text-micro text-muted">
          <label>Federal effect via
            <select value={fed.category} onChange={(e) => setOverride((o) => ({ ...o, fed: e.target.value as EffectCategory }))} className="mt-0.5 w-full rounded-lg border border-line bg-surface px-1.5 py-1 text-meta text-ink">
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select></label>
          <label>California effect via
            <select value={ca.category} onChange={(e) => setOverride((o) => ({ ...o, ca: e.target.value as EffectCategory }))} className="mt-0.5 w-full rounded-lg border border-line bg-surface px-1.5 py-1 text-meta text-ink">
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select></label>
        </div>
        {valid && <EffectLine fedTax={eff.fedTax} caTax={eff.caTax} fedBal={eff.fedBalance} caBal={eff.caBalance} />}
        <ActionButton variant="primary" size="sm" done="Adjustment proposed" body="The original value is kept. Approval is required."
          disabledReason={!valid ? 'Enter the new value.' : !reason.trim() ? 'Every adjustment needs a reason.' : null}
          actions={{ type: 'adjustment.proposed', refs: [lineKey], payload: { lineKey, from: cur.value, to: target, fed, ca, reason } }}
          onDone={() => { setTo(''); setReason('') }}>
          <Icon name="edit" size={13} />Propose adjustment
        </ActionButton>
      </div>
    </Section>
  )
}

export function EffectLine({ fedTax, caTax, fedBal, caBal }: { fedTax: number; caTax: number; fedBal: number; caBal: number }) {
  const part = (label: string, tax: number, bal: number) => (
    <span>{label} tax <b className={cx('tnum', tax > 0 ? 'text-danger' : tax < 0 ? 'text-good' : '')}>{fmtSigned(tax)}</b>
      {Math.round(bal) !== Math.round(tax) && <> · balance <b className="tnum">{fmtSigned(bal)}</b></>}</span>
  )
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-micro text-muted">
      {part('Federal', fedTax, fedBal)}{part('California', caTax, caBal)}
      <span className="text-faint">Estimate from per-dollar rates</span>
    </div>
  )
}

/* ---------------- History ---------------- */

function History({ lineKey }: { lineKey: string }) {
  const m = useModel()
  const d = useDerived()
  const people = usePeople()
  const [rejectNote, setRejectNote] = useState('')
  const adjs = d.adjByLine.get(lineKey) ?? []
  return (
    <>
      <Section title="Across engine versions">
        <div className="overflow-hidden rounded-lg border border-line2">
          {m.versionOrder.map((v) => {
            const vi = m.versions.get(v)!
            const l = vi.lines.get(lineKey)
            const ch = vi.v.changes_from_previous.find((c) => c.key === lineKey)
            return (
              <div key={v} className="flex items-center gap-3 border-b border-line2 px-3 py-2 text-meta last:border-0">
                <span className="w-8 font-mono text-micro text-accent">{v}</span>
                <span className="w-24 text-micro text-muted">{vi.v.computed_at.slice(0, 10)}</span>
                <span className="min-w-0 flex-1 truncate text-micro text-muted">{ch ? `${ch.change}${ch.change === 'changed' ? ` from ${fmtValue(ch.old)}` : ''}` : l ? 'unchanged' : 'not present'}</span>
                <span className="tnum">{l ? fmtValue(l.value) : '-'}</span>
              </div>
            )
          })}
        </div>
      </Section>
      <Section title="Adjustments">
        {adjs.length === 0 ? <p className="text-meta text-muted">No adjustments. The engine value stands.</p> : (
          <ul className="space-y-2">{adjs.map((a) => {
            const p = people(a.by)
            return (
              <li key={a.id} className="rounded-lg border border-line2 p-2.5 text-meta">
                <div className="flex items-center gap-2">
                  <Avatar user={p.avatar} size={20} /><b>{p.name}</b>
                  <span className="tnum text-muted">{fmtValue(a.from)} → <b className="text-ink">{fmtValue(a.to)}</b></span>
                  <span className="ml-auto"><StatusBadge vocab={ADJ_STATUS} value={a.status} /></span>
                </div>
                <p className="mt-1 text-ink">{a.reason}</p>
                <div className="mt-1"><EffectLine fedTax={a.effect.fedTax} caTax={a.effect.caTax} fedBal={a.effect.fedBalance} caBal={a.effect.caBalance} /></div>
                {a.decidedBy && <div className="mt-1 text-micro text-muted">{a.status} by {people(a.decidedBy).name}{a.decisionNote ? `: ${a.decisionNote}` : ''}</div>}
                {a.status === 'proposed' && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <ActionButton size="sm" variant="good" done="Adjustment approved"
                      actions={{ type: 'adjustment.approved', refs: [a.lineKey], payload: { adjustmentId: a.id } }}>
                      <Icon name="check" size={12} />Approve
                    </ActionButton>
                    <input value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Reason to reject"
                      className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1 text-meta" />
                    <ActionButton size="sm" variant="danger" done="Adjustment rejected" disabledReason={!rejectNote.trim() ? 'Give a reason to reject.' : null}
                      actions={{ type: 'adjustment.rejected', refs: [a.lineKey], payload: { adjustmentId: a.id, note: rejectNote } }} onDone={() => setRejectNote('')}>
                      Reject
                    </ActionButton>
                  </div>
                )}
                <div className="mt-1 text-micro text-faint">{fmtDateTime(a.at)}</div>
              </li>
            )
          })}</ul>
        )}
      </Section>
    </>
  )
}

/* ---------------- Notes ---------------- */

function Notes({ lineKey }: { lineKey: string }) {
  const d = useDerived()
  const people = usePeople()
  const [text, setText] = useState('')
  const [blocking, setBlocking] = useState(false)
  const [resolution, setResolution] = useState('')
  const notes = d.notes.filter((n) => n.refs.includes(lineKey))
  return (
    <>
      <Section title="Discussion">
        {notes.length === 0 ? <p className="text-meta text-muted">No notes on this line.</p> : (
          <ul className="space-y-2">{notes.map((n) => {
            const p = people(n.by)
            return (
              <li key={n.id} className={cx('rounded-lg border p-2.5 text-meta', n.blocking && !n.resolved ? 'border-danger/40 bg-danger-soft/40' : 'border-line2')}>
                <div className="flex items-center gap-2"><Avatar user={p.avatar} size={20} /><b>{p.name}</b>
                  {n.kind === 'review' && <Tag tone={n.blocking && !n.resolved ? 'danger' : 'muted'}>{n.blocking ? 'Blocking review note' : 'Review note'}</Tag>}
                  {n.resolved && <Tag tone="good">Resolved</Tag>}
                  <span className="ml-auto text-micro text-faint">{fmtDateTime(n.at)}</span></div>
                <p className="mt-1 text-ink">{n.text}</p>
                {n.resolved && <p className="mt-1 text-muted">Resolved by {people(n.resolved.by).name}: {n.resolved.resolution}</p>}
                {!n.resolved && (
                  <div className="mt-2 flex gap-1.5">
                    <input value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Resolution"
                      className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1 text-meta" />
                    <ActionButton size="sm" done="Note resolved" disabledReason={!resolution.trim() ? 'Say how it was resolved.' : null}
                      actions={{ type: 'note.resolved', refs: n.refs, payload: { noteId: n.id, resolution } }} onDone={() => setResolution('')}>Resolve</ActionButton>
                  </div>
                )}
              </li>
            )
          })}</ul>
        )}
      </Section>
      <Section title="Evidence attached">
        <Attachments refId={lineKey} />
      </Section>
      <Section title="Questions about this line">
        <ThreadList filter={(t) => t.refs.includes(lineKey)} empty="No questions asked about this line." />
        <div className="mt-2"><AskForm refs={[lineKey]} compact /></div>
      </Section>
      <Section title="Add a note">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Question, review comment or explanation"
          className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-body placeholder:text-faint" />
        <label className="mt-1.5 flex items-center gap-2 text-meta text-muted">
          <input type="checkbox" checked={blocking} onChange={(e) => setBlocking(e.target.checked)} />Review note that blocks filing until resolved
        </label>
        <div className="mt-2">
          <ActionButton size="sm" variant="primary" done={blocking ? 'Blocking review note added' : 'Note added'} disabledReason={!text.trim() ? 'Write the note first.' : null}
            actions={{ type: 'note.created', refs: [lineKey], payload: { text, blocking, kind: blocking ? 'review' : 'note' } }}
            onDone={() => { setText(''); setBlocking(false) }}>
            <Icon name="note" size={13} />Add note
          </ActionButton>
        </div>
      </Section>
    </>
  )
}

/* ---------------- Related ---------------- */

function Related({ lineKey }: { lineKey: string }) {
  const m = useModel()
  const findings = useFindings()
  const line = m.current.lines.get(lineKey)
  const py = m.packet.prior_years.return_2024
  const ly = py.lines[lineKey]
  const std = useDerived().standards.variance_review
  const cur = line && typeof line.value === 'number' ? line.value : null
  const diff = ly != null && cur != null ? cur - ly : null
  const pctChange = diff != null && ly ? Math.abs(diff / ly) * 100 : null
  const flagged = diff != null && Math.abs(diff) > std.and_over_amount && (pctChange == null || pctChange > std.flag_if_change_over_percent)
  const touching = findings.filter((f) => f.lines.includes(lineKey))
  const area = areaOf(lineKey)
  const related = m.packet.household.related_returns.filter((r) => area === 'passthroughs' ? /Inc\.|LP/.test(r.who) : area === 'deductions' && /Ada/.test(r.who))
  return (
    <>
      <Section title="Last year (2024 as filed)">
        {ly == null ? <p className="text-meta text-muted">No matching line on the 2024 return.</p> : (
          <Card className="p-3 text-meta">
            <div className="flex items-center justify-between"><span>{py.line_labels[lineKey]}</span><span className="tnum font-semibold">{fmtNum(ly)}</span></div>
            {diff != null && (
              <div className="mt-1 flex items-center justify-between text-muted"><span>Change to {m.current.v.version}</span>
                <span className={cx('tnum', flagged && 'font-semibold text-warn')}>{fmtSigned(diff)}{pctChange != null && ` (${Math.round(pctChange)}%)`}</span></div>
            )}
            {flagged && <div className="mt-1.5 flex items-center gap-1.5 text-warn"><Icon name="alert" size={12} />Over the firm's variance threshold ({std.flag_if_change_over_percent}% and {fmtNum(std.and_over_amount)}): explain it in a note.</div>}
            {py.line_sources[lineKey] && <div className="mt-2"><RefChip id={py.line_sources[lineKey]} compact /></div>}
          </Card>
        )}
      </Section>
      {touching.length > 0 && (
        <Section title="Findings on this line">
          <ul className="space-y-1.5">{touching.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-lg border border-line2 px-2.5 py-1.5 text-meta">
              <StatusBadge vocab={SEVERITY} value={f.severity} /><span className="min-w-0 flex-1 truncate">{f.title}</span>
            </li>
          ))}</ul>
        </Section>
      )}
      {related.length > 0 && (
        <Section title="Related returns">
          <ul className="space-y-1.5">{related.map((r) => (
            <li key={r.who} className="rounded-lg border border-line2 px-2.5 py-1.5 text-meta"><b>{r.who}</b><div className="text-muted">{r.return} · {r.prepared_by}</div></li>
          ))}</ul>
        </Section>
      )}
    </>
  )
}
