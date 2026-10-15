// Source documents sit behind this interface. The simulated provider renders
// each page from printed_content (what is actually printed) and finds the exact
// spot a value was read from. A real provider would render the PDF page image
// and draw the same bounding box (extracted_values[].position, page fractions):
// the viewer, trace and every link stay as they are.
import type { ReactNode } from 'react'
import type { Model } from '../../lib/packet/model'
import type { ExtractedValue, Position } from '../../lib/packet/types'
import { maskText } from '../Sensitive'

export interface Locator { docId: string; page: number; bbox: Position | null; text: string; evId: string }

export interface SourceDocumentProvider {
  pageCount(docId: string): number
  locate(evId: string): Locator | null
  renderPage(p: { docId: string; page: number; highlight?: Locator | null; revealed: boolean }): ReactNode
}

/** Where on the printed text a value was read: the occurrence whose lead-in best matches the label. */
export function findSpan(text: string, ev: ExtractedValue): [number, number] | null {
  const needle = ev.text_as_read
  if (!needle) return null
  const hits: number[] = []
  for (let i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + 1)) {
    const before = text[i - 1]; const after = text[i + needle.length]
    if ((before && /[\d.,]/.test(before) && /^\d/.test(needle)) || (after && /\d/.test(after))) continue
    hits.push(i)
  }
  if (!hits.length) return null
  const words = (ev.label + ' ' + ev.field).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2)
  let best = hits[0]; let bestScore = -1
  for (const h of hits) {
    const lead = text.slice(Math.max(0, h - 50), h).toLowerCase()
    const score = words.reduce((s, w) => s + (lead.includes(w) ? 1 : 0), 0)
    if (score > bestScore) { best = h; bestScore = score }
  }
  return [best, best + needle.length]
}

export function simulatedProvider(m: Model): SourceDocumentProvider {
  return {
    pageCount: (docId) => m.docs.get(docId)?.page_count ?? 0,
    locate: (evId) => {
      const e = m.evs.get(evId)
      return e ? { docId: e.document_id, page: e.page, bbox: e.position, text: e.text_as_read, evId } : null
    },
    renderPage: ({ docId, page, highlight, revealed }) => {
      const doc = m.docs.get(docId)
      const p = doc?.pages.find((x) => x.page === page)
      if (!doc || !p) return null
      const text = p.printed_content
      const ev = highlight?.docId === docId && highlight.page === page ? m.evs.get(highlight.evId) : undefined
      const span = ev ? findSpan(text, ev) : null
      const show = (s: string) => (revealed ? s : maskText(s))
      return (
        <p className="whitespace-pre-wrap break-words font-mono text-meta leading-[31px] text-ink/85">
          {span ? (
            <>
              {show(text.slice(0, span[0]))}
              <mark data-hl className="rounded-sm bg-accent-soft px-0.5 font-semibold text-accent-deep outline outline-2 outline-accent">{show(text.slice(span[0], span[1]))}</mark>
              {show(text.slice(span[1]))}
            </>
          ) : show(text)}
        </p>
      )
    },
  }
}
