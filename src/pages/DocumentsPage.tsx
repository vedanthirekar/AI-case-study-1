// Every document, grouped by where it landed (or why it did not), beside the viewer.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useShell } from '../components/shell/ShellContext'
import StatusBadge, { StatusLegend } from '../components/StatusBadge'
import { Icon, Tooltip, cx } from '../components/ui'
import { useApp, useModel } from '../state/app'
import { fmtDate } from '../lib/format'
import { DOC_STATUS } from '../features/vocab'
import { docStatus, type DocState } from '../features/documents/docStatus'
import DocumentViewer from '../features/documents/DocumentViewer'
import { RefChip } from '../features/RefChip'
import { useFindings, evidenceDocs } from '../features/findings'

const ORDER: DocState[] = ['partial', 'unused', 'used', 'evidence', 'duplicate', 'superseded', 'record', 'pending']

export default function DocumentsPage() {
  const m = useModel()
  const simNow = useApp((s) => s.simNow)
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const { publish } = useShell()
  const findings = useFindings()
  const [q, setQ] = useState('')
  const [legend, setLegend] = useState(false)

  const evidence = useMemo(() => evidenceDocs(findings, (id) => m.evs.get(id)?.document_id), [findings, m])
  const statuses = useMemo(() => new Map(m.packet.documents.map((d) => [d.id, docStatus(m, d, simNow, evidence)])), [m, simNow, evidence])
  const current = id ? m.docs.get(id) : undefined
  useEffect(() => {
    publish({ crumbs: [{ label: 'Documents', to: '/documents' }, ...(current ? [{ label: `${current.id} ${current.title}` }] : [])] })
  }, [publish, current])

  const query = q.trim().toLowerCase()
  const docs = m.packet.documents.filter((d) => !query || `${d.id} ${d.title} ${d.issuer} ${d.document_type}`.toLowerCase().includes(query))
  const counts = ORDER.map((s) => [s, m.packet.documents.filter((d) => statuses.get(d.id)!.state === s).length] as const)
  const st = current ? statuses.get(current.id)! : null
  const citedBy = current ? findings.filter((f) => f.evidence.some((e) => e === current.id || e.startsWith(`doc:${current.id}#`) || m.evs.get(e)?.document_id === current.id)) : []

  return (
    <div className="flex h-full min-h-0">
      <div className="pane flex w-[400px] shrink-0 flex-col border-r border-line bg-surface">
        <div className="space-y-2 border-b border-line p-3">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-title font-bold">Documents</h1>
            <Tooltip label="What the statuses mean" side="bottom-end"><button onClick={() => setLegend((x) => !x)} className="text-muted hover:text-ink"><Icon name="help" size={15} /></button></Tooltip>
          </div>
          <p className="text-meta text-muted">{m.packet.documents.length} documents. Every one is accounted for: where it landed, or why not.</p>
          <div className="flex items-center gap-2 rounded-lg border border-line bg-bg px-2.5 py-1.5">
            <Icon name="search" size={14} className="text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents" className="w-full bg-transparent text-body outline-none placeholder:text-faint" />
          </div>
          <div className="flex flex-wrap gap-1">
            {counts.filter(([, n]) => n > 0).map(([s, n]) => <StatusBadge key={s} vocab={DOC_STATUS} value={s} suffix={n} />)}
          </div>
          {legend && <StatusLegend vocab={DOC_STATUS} columns={1} />}
        </div>
        <div className="pane min-h-0 flex-1 overflow-y-auto">
          {ORDER.map((s) => {
            const list = docs.filter((d) => statuses.get(d.id)!.state === s)
            if (!list.length) return null
            return (
              <div key={s}>
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line2 bg-bgtint px-3 py-1.5 text-micro font-bold uppercase tracking-wider text-faint">
                  <span>{DOC_STATUS[s].label}</span><span className="tnum">{list.length}</span>
                </div>
                {list.map((d) => {
                  const ds = statuses.get(d.id)!
                  return (
                    <button key={d.id} onClick={() => nav(`/documents/${d.id}`)}
                      className={cx('flex w-full items-start gap-2.5 border-b border-line2 px-3 py-2 text-left transition',
                        d.id === id ? 'bg-accent-soft/60 shadow-[inset_2px_0_0_rgb(var(--c-accent))]' : 'hover:bg-slateSoft')}>
                      <Icon name="doc" size={15} className="mt-0.5 shrink-0 text-faint" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-medium text-ink">{d.title}</span>
                        <span className="block truncate text-micro text-muted"><span className="font-mono">{d.id}</span> · {d.document_type} · {fmtDate(d.received_at)}</span>
                        <span className="block truncate text-micro text-faint">{ds.reason}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      <div className="pane min-w-0 flex-1 overflow-y-auto p-5">
        {!current ? (
          <div className="grid h-full place-items-center text-center text-body text-muted">
            <div><Icon name="doc" size={24} className="mx-auto mb-2 text-faint" />Pick a document to see its pages, what was read from them, and where each value landed.</div>
          </div>
        ) : (
          <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[1fr_320px]">
            <div className="min-h-[70vh]">
              <DocumentViewer key={current.id} docId={current.id} tall
                page={params.get('page') ? Number(params.get('page')) : undefined}
                evId={params.get('ev')}
                onSelectEv={(ev) => setParams((p) => { const n = new URLSearchParams(p); n.set('ev', ev); n.delete('page'); return n })} />
            </div>
            <div className="space-y-4">
              <section>
                <div className="mb-1.5 text-micro font-bold uppercase tracking-wider text-faint">Status</div>
                <div className="rounded-xl2 border border-line bg-surface p-3 text-meta">
                  <StatusBadge vocab={DOC_STATUS} value={st!.state} />
                  <p className="mt-2 text-ink">{st!.reason}</p>
                  {st!.relatedDoc && <div className="mt-2"><RefChip id={st!.relatedDoc} compact /></div>}
                </div>
              </section>
              {st!.lines.length > 0 && (
                <section>
                  <div className="mb-1.5 text-micro font-bold uppercase tracking-wider text-faint">Landed in {st!.lines.length} line{st!.lines.length > 1 ? 's' : ''}</div>
                  <div className="max-h-[40vh] space-y-1.5 overflow-auto pr-1">{st!.lines.map((k) => <RefChip key={k} id={k} compact />)}</div>
                </section>
              )}
              {citedBy.length > 0 && (
                <section>
                  <div className="mb-1.5 text-micro font-bold uppercase tracking-wider text-faint">Cited by {citedBy.length} finding{citedBy.length > 1 ? 's' : ''}</div>
                  <ul className="space-y-1.5">{citedBy.map((f) => (
                    <li key={f.id}><button onClick={() => nav(`/review?f=${encodeURIComponent(f.id)}`)} className="w-full rounded-lg border border-line2 bg-surface px-2.5 py-1.5 text-left text-meta transition hover:border-accent/50">{f.title}</button></li>
                  ))}</ul>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
