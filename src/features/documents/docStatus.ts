// Where every document landed, or why it did not.
import type { Model } from '../../lib/packet/model'
import type { Doc } from '../../lib/packet/types'

export type DocState = 'used' | 'evidence' | 'record' | 'superseded' | 'duplicate' | 'partial' | 'unused' | 'pending'

export interface DocStatus { state: DocState; lines: string[]; reason: string; relatedDoc?: string }

const RECORD: Record<string, string> = {
  engagement_letter: 'Engagement record: scope, fee and signatures (required step).',
  consent_7216: 'Consent to use and disclose tax information (required step).',
  irs_ip_pin_notice: 'Identity Protection PIN, entered at e-file rather than on a line.',
  identity_document: 'Identity verification (required step).',
  prior_year_return: 'Prior-year return: comparison, carryovers and variance.',
  prior_workpaper: 'Prior preparer\'s file: notes, open items and schedules.',
  irs_transcript: 'Agency record used to agree payments.',
  irs_notice: 'Agency correspondence.',
  '3922': 'Informational ESPP record; the basis adjustment comes from the stock plan supplement.',
  letter: 'Supports an amount on another document.',
}

/** evidenceDocs: documents our checks cite. Not on a line, but not idle either. */
export function docStatus(m: Model, d: Doc, simNow: string, evidenceDocs?: Set<string>): DocStatus {
  const lines = m.current.linesByDoc.get(d.id) ?? []
  if (d.received_at > simNow) return { state: 'pending', lines: [], reason: `Arrives ${d.received_at.slice(0, 10)}.` }
  if (m.current.v.documents_superseded.includes(d.id)) {
    const by = m.packet.documents.find((x) => x.marked_corrected && x.id !== d.id && x.document_type === d.document_type && x.issuer === d.issuer)
    return { state: 'superseded', lines: [], reason: `Replaced by the corrected statement${by ? ` ${by.id}` : ''}.`, relatedDoc: by?.id }
  }
  for (const l of m.current.v.lines) {
    // e.g. "D10 is a second image of the Halvorsen W-2 (D09); counted once."
    const dup = l.note?.match(new RegExp(`${d.id} is a second image of[^.]*?(D\\d{2})`))
    if (dup) return { state: 'duplicate', lines: [], reason: `Second image of ${dup[1]}; counted once (${l.key}).`, relatedDoc: dup[1] }
  }
  if (d.extraction.status === 'partial') return { state: 'partial', lines, reason: d.extraction.reason ?? 'Some pages were not read.' }
  if (lines.length) return { state: 'used', lines, reason: `Feeds ${lines.length} line${lines.length > 1 ? 's' : ''}.` }
  if (RECORD[d.document_type]) return { state: 'record', lines: [], reason: RECORD[d.document_type] }
  if (d.extraction.status === 'not_extracted') return { state: 'record', lines: [], reason: d.extraction.reason ?? 'Not extracted.' }
  if (evidenceDocs?.has(d.id)) return { state: 'evidence', lines: [], reason: 'No line uses it, but independent checks rely on it as evidence.' }
  return { state: 'unused', lines: [], reason: 'Nothing on the return comes from this document.' }
}
