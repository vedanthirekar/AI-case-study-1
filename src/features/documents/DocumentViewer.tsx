// A source document page, with the exact field a value came from highlighted.
// Ideas from the kit's reference viewer (paging, zoom, one matched region,
// explicit empty states); rendering goes through the document provider.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, Tag, Tooltip, cx } from '../../components/ui'
import StatusBadge from '../../components/StatusBadge'
import { useApp, useCan, useModel } from '../../state/app'
import { fmtDate, fmtValue } from '../../lib/format'
import { DOC_STATUS } from '../vocab'
import { hasSensitive, maskText } from '../Sensitive'
import { simulatedProvider } from './provider'
import { docStatus } from './docStatus'
import { useTrace } from '../trace/useTrace'
import { useToast } from '../../components/Toast'
import { useFindings, evidenceDocs } from '../findings'

export default function DocumentViewer({ docId, page: pageProp, evId, onSelectEv, tall = false, showValues = true }: {
  docId: string; page?: number; evId?: string | null
  onSelectEv?: (evId: string) => void
  tall?: boolean; showValues?: boolean
}) {
  const m = useModel()
  const simNow = useApp((s) => s.simNow)
  const provider = useMemo(() => simulatedProvider(m), [m])
  const doc = m.docs.get(docId)
  const target = evId ? provider.locate(evId) : null
  const [page, setPage] = useState(pageProp ?? target?.page ?? 1)
  const [zoom, setZoom] = useState(1)
  const [revealed, setRevealed] = useState(false)
  const paperRef = useRef<HTMLDivElement>(null)
  const can = useCan()
  const dispatch = useApp((s) => s.dispatch)
  const toast = useToast()
  const { open } = useTrace()
  const findings = useFindings()
  const evidence = useMemo(() => evidenceDocs(findings, (id) => m.evs.get(id)?.document_id), [findings, m])

  useEffect(() => { setPage(target?.page ?? pageProp ?? 1); setRevealed(false) }, [docId, evId, pageProp]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { paperRef.current?.querySelector('[data-hl]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [page, evId, docId])

  if (!doc) return <div className="rounded-xl2 border border-dashed border-line p-6 text-center text-body text-muted">No such document.</div>

  const st = docStatus(m, doc, simNow, evidence)
  const pages = doc.page_count
  const pageText = doc.pages.find((p) => p.page === page)?.printed_content ?? ''
  const onPage = (m.evsByDoc.get(doc.id) ?? []).filter((e) => e.page === page)
  const sensitive = hasSensitive(pageText) || onPage.some((e) => ['ssn', 'account_number'].includes(e.value_type))
  const revealAction = { type: 'sensitive.revealed' as const, refs: [`doc:${doc.id}#page${page}`], payload: { field: `doc:${doc.id}#page${page}`, label: `${doc.title}, page ${page}` } }
  const revealVerdict = can(revealAction)
  const reveal = async () => {
    const r = await dispatch(revealAction)
    if (r.ok) { setRevealed(true); toast({ title: 'Sensitive data revealed', body: 'This view is logged.' }) }
  }

  return (
    <div className={cx('flex flex-col overflow-hidden rounded-xl2 border border-line bg-surface', tall && 'h-full')}>
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-line2 bg-bgtint/60 px-4 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon name="doc" size={15} className="shrink-0 text-faint" />
            <span className="truncate text-body font-semibold">{doc.title}</span>
          </div>
          <div className="mt-0.5 truncate text-micro text-muted">
            <span className="font-mono">{doc.id}</span> · received {fmtDate(doc.received_at)} · uploaded by {doc.uploaded_by} · {doc.file_name}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {doc.marked_corrected && <Tag tone="accent">Corrected</Tag>}
          <StatusBadge vocab={DOC_STATUS} value={st.state} />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-line2 px-3 py-1.5">
        <PagerBtn icon="chevron-left" label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} />
        <span className="tnum text-micro text-muted">Page {page} / {pages}</span>
        <PagerBtn icon="chevron" label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} />
        {target && target.page !== page && (
          <button onClick={() => setPage(target.page)} className="ml-1 text-micro font-semibold text-accent hover:underline">Back to the matched value (page {target.page})</button>
        )}
        <div className="ml-auto flex items-center gap-1">
          {sensitive && !revealed && (
            <Tooltip label={revealVerdict.ok ? 'Show full numbers. Every reveal is logged.' : revealVerdict.reason} side="bottom-end">
              <button onClick={reveal} disabled={!revealVerdict.ok}
                className="mr-1 flex items-center gap-1 rounded-sm border border-line px-1.5 py-0.5 text-micro font-semibold text-muted transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50">
                <Icon name={revealVerdict.ok ? 'eye' : 'lock'} size={12} />Masked
              </button>
            </Tooltip>
          )}
          <PagerBtn icon="zoom-out" label="Zoom out" disabled={zoom <= 0.85} onClick={() => setZoom((z) => Math.round((z - 0.15) * 100) / 100)} />
          <span className="tnum w-9 text-center text-micro text-faint">{Math.round(zoom * 100)}%</span>
          <PagerBtn icon="zoom-in" label="Zoom in" disabled={zoom >= 1.6} onClick={() => setZoom((z) => Math.round((z + 0.15) * 100) / 100)} />
        </div>
      </div>

      <div ref={paperRef} className={cx('pane min-h-0 overflow-auto bg-bgtint/30 p-3', tall ? 'flex-1' : 'max-h-[360px]')}>
        <div className="paper origin-top-left rounded-lg border border-line px-5 py-[3px] transition-transform"
          style={{ transform: `scale(${zoom})`, width: `${100 / zoom}%` }}>
          <div className="flex items-center justify-between py-[3px]">
            <span className="rounded bg-inverse px-2 py-0.5 text-micro font-bold uppercase tracking-wider text-inverse-fg">{doc.document_type.replace(/_/g, ' ')}</span>
            <span className="text-micro text-faint">{doc.issuer && doc.issuer !== '-' ? `${doc.issuer} · ` : ''}Tax year {doc.tax_year} · simulated from printed content</span>
          </div>
          {pageText ? provider.renderPage({ docId: doc.id, page, highlight: target, revealed }) : (
            <div className="py-8 text-center text-micro text-faint">This page has no printed content in the packet.</div>
          )}
        </div>
      </div>

      {showValues && (
        <div className="max-h-56 shrink-0 overflow-auto border-t border-line">
          <div className="sticky top-0 flex items-center justify-between bg-surface px-3 pb-1 pt-2 text-micro font-bold uppercase tracking-wider text-faint">
            <span>Read from page {page} ({onPage.length})</span>
            {doc.extraction.status !== 'extracted' && <span className="normal-case tracking-normal text-warn">{doc.extraction.reason}</span>}
          </div>
          {onPage.length === 0 ? (
            <div className="px-3 pb-3 text-meta text-muted">{doc.extraction.status === 'not_extracted' ? doc.extraction.reason : 'Nothing was extracted from this page.'}</div>
          ) : (
            <ul className="px-1.5 pb-1.5">
              {onPage.map((e) => {
                const used = m.current.linesByEv.get(e.id) ?? []
                const active = e.id === evId
                const v = typeof e.value === 'string' && !revealed ? maskText(e.value) : fmtValue(e.value)
                return (
                  <li key={e.id}>
                    <button onClick={() => onSelectEv?.(e.id)}
                      className={cx('flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-meta transition', active ? 'bg-accent-soft/70 shadow-[inset_2px_0_0_rgb(var(--c-accent))]' : 'hover:bg-slateSoft')}>
                      <span className="min-w-0 flex-1 truncate text-ink">{e.label}</span>
                      <span className="tnum shrink-0 text-ink">{v}</span>
                      <Confidence value={e.confidence} />
                      <span className="flex w-28 shrink-0 justify-end gap-1">
                        {used.length === 0 ? <span className="text-micro text-faint">not used</span> : used.slice(0, 2).map((k) => (
                          <span key={k} role="link" tabIndex={0} onClick={(x) => { x.stopPropagation(); open(k) }}
                            className="truncate rounded-sm border border-line px-1 font-mono text-micro text-accent hover:border-accent">{k}</span>
                        ))}
                        {used.length > 2 && <span className="text-micro text-faint">+{used.length - 2}</span>}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/** Extraction confidence: how sure the reader was, never whether it is right (DESIGN rule 9). */
export function Confidence({ value }: { value: number }) {
  const tone = value >= 0.9 ? 'text-good' : value >= 0.6 ? 'text-warn' : 'text-danger'
  return (
    <Tooltip label={`Read with ${Math.round(value * 100)}% confidence. Confidence is not verification.`}>
      <span className={cx('tnum w-9 shrink-0 text-right text-micro', tone)}>{Math.round(value * 100)}%</span>
    </Tooltip>
  )
}

function PagerBtn({ icon, label, onClick, disabled }: { icon: string; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} title={label} aria-label={label}
      className="grid h-6 w-6 place-items-center rounded text-muted transition hover:bg-slateSoft disabled:opacity-30">
      <Icon name={icon} size={14} />
    </button>
  )
}
