// REFERENCE ONLY - do not import or port this file as-is.
// It was written for a different project's data shape (doc.boxes, DOC_STATUS from
// a catalog that does not exist here). Reuse the interaction ideas: page
// navigation, zoom, one highlighted "matched" region, and explicit empty states.
// The real viewer should render documents[].pages[].printed_content and place
// highlights from extracted_values[].position, behind an interface that lets real
// page images replace the simulated rendering later.
//
// Faux source document with highlightable regions.
// No real OCR - each mock doc carries a list of "boxes". When a return field is
// selected, the box it was extracted from is highlighted and the viewer jumps to
// the page it lives on, giving a real "this number came from exactly here"
// experience. Page navigation and zoom exist because a reviewer checking a
// figure needs to look around the document, not just at one row of it.
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Icon, Tag, cx } from '../../components/ui'
import { DOC_STATUS } from '../../data/catalog'

export default function SourceDocViewer({ doc, highlightBox, tall = false }) {
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)

  const boxes = doc?.boxes || []
  const pageOf = (b) => b?.page || 1

  // follow the selection: jump to whichever page the matched box lives on
  useEffect(() => {
    const b = boxes.find((x) => x.key === highlightBox)
    if (b) setPage(pageOf(b))
  }, [highlightBox, doc?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(1); setZoom(1) }, [doc?.id])

  if (!doc) {
    return (
      <div className={cx('grid place-items-center rounded-xl2 border border-dashed border-line bg-surface p-8 text-center text-body text-muted', tall && 'h-full')}>
        <div>
          <Icon name="doc" size={22} className="mx-auto mb-2 text-faint" />
          No source document for this line.<br />
          <span className="text-micro text-faint">Manually entered values have no document to trace back to.</span>
        </div>
      </div>
    )
  }

  const st = DOC_STATUS[doc.status]
  const pages = Math.max(doc.pages || 1, ...boxes.map(pageOf))
  const onPage = boxes.filter((b) => pageOf(b) === page)
  const matched = boxes.find((b) => b.key === highlightBox)

  return (
    <div className={cx('flex flex-col overflow-hidden rounded-xl2 border border-line bg-surface shadow-e2', tall && 'h-full')}>
      {/* document header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line2 bg-bgtint/60 px-4 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon name="doc" size={15} className="shrink-0 text-faint" />
            <span className="truncate text-body font-semibold">{doc.name}</span>
          </div>
          <div className="mt-0.5 truncate text-micro text-muted">
            uploaded {doc.uploaded} · {doc.source === 'client-upload' ? 'client upload' : 'auto-imported'}
          </div>
        </div>
        <Tag tone={st?.tone || 'muted'} dot>{st?.label}</Tag>
      </div>

      {/* pager + zoom */}
      <div className="flex shrink-0 items-center gap-2 border-b border-line2 bg-surface px-3 py-1.5">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} title="Previous page"
          className="grid h-6 w-6 place-items-center rounded text-muted transition hover:bg-slateSoft disabled:opacity-30">
          <Icon name="chevron-left" size={14} />
        </button>
        <span className="tnum text-micro text-muted">Page {page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} title="Next page"
          className="grid h-6 w-6 place-items-center rounded text-muted transition hover:bg-slateSoft disabled:opacity-30">
          <Icon name="chevron" size={14} />
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button disabled={zoom <= 0.85} onClick={() => setZoom((z) => Math.round((z - 0.15) * 100) / 100)} title="Zoom out"
            className="grid h-6 w-6 place-items-center rounded text-muted transition hover:bg-slateSoft disabled:opacity-30">
            <Icon name="zoom-out" size={14} />
          </button>
          <span className="tnum w-9 text-center text-micro text-faint">{Math.round(zoom * 100)}%</span>
          <button disabled={zoom >= 1.6} onClick={() => setZoom((z) => Math.round((z + 0.15) * 100) / 100)} title="Zoom in"
            className="grid h-6 w-6 place-items-center rounded text-muted transition hover:bg-slateSoft disabled:opacity-30">
            <Icon name="zoom-in" size={14} />
          </button>
        </div>
      </div>

      {/* the "paper" */}
      <div className={cx('pane min-h-0 overflow-auto p-3', tall ? 'flex-1 bg-bgtint/30' : '')}>
        <div className="paper origin-top rounded-lg border border-line p-5 transition-transform"
          style={{ transform: `scale(${zoom})`, marginBottom: zoom > 1 ? `${(zoom - 1) * 300}px` : 0 }}>
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded bg-inverse px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-inverse-fg">{doc.type}</span>
            <span className="text-micro text-faint">{doc.issuer && doc.issuer !== '-' ? `${doc.issuer} · ` : ''}Tax year 2025 · sample</span>
          </div>

          {onPage.length > 0 ? onPage.map((b) => {
            const on = b.key === highlightBox
            return (
              <div key={b.key}
                className={cx('flex items-center justify-between rounded-md px-2 py-1.5 text-[12.5px] transition',
                  on ? 'bg-accent/12 outline outline-2 outline-accent' : '')}>
                <span className={cx(on ? 'font-semibold text-ink' : 'text-muted')}>{b.label}</span>
                <span className={cx('tnum', on ? 'font-bold text-ink' : 'text-ink/80')}>{b.value}</span>
                {on && (
                  <motion.span initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }}
                    className="ml-2 rounded bg-accent-fill px-1.5 py-0.5 text-[10px] font-bold text-white">matched</motion.span>
                )}
              </div>
            )
          }) : (
            <div className="py-10 text-center text-micro text-faint">
              {boxes.length === 0
                ? 'Document preview - parsed regions were not fabricated for this sample.'
                : matched
                  ? `Nothing extracted from page ${page}. The matched value is on page ${pageOf(matched)}.`
                  : `Nothing extracted from page ${page}.`}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
