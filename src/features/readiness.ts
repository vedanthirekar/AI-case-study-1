// The firm's required steps, each with a status computed from the packet and
// the log where it can be. "Done" here is evidence, not a checkbox.
import type { Model } from '../lib/packet/model'
import type { Derived } from '../lib/workpaper/derive'
import { scopeSnapshot, hashOf } from '../lib/workpaper/derive'
import { docStatus } from './documents/docStatus'
import { evidenceDocs, type ReviewedFinding } from './findings'
import { C, docHref, reviewHref, filingHref, schedulesHref } from '../lib/paths'

export interface Step { name: string; done: boolean; detail: string; href?: string }

export function readiness(m: Model, d: Derived, findings: ReviewedFinding[], simNow: string): Step[] {
  const has = (type: string) => m.packet.documents.some((x) => x.document_type === type && x.received_at <= simNow)
  const cited = evidenceDocs(findings, (id) => m.evs.get(id)?.document_id)
  const statuses = m.packet.documents.map((x) => docStatus(m, x, simNow, cited))
  const loose = statuses.filter((s) => s.state === 'unused' || s.state === 'partial').length
  const carry = m.current.v.lines.filter((l) => l.rule === 'R-PRIOR-YEAR-CARRY')
  const carryDone = carry.filter((l) => d.verifications.has(l.key)).length
  const pay = findings.filter((f) => /estimates-vs-transcript|ca-payments/.test(f.id))
  const open = findings.filter((f) => f.status === 'open' && f.severity !== 'info')
  const dd = d.decisions.some((e) => e.payload.kind === 'due_diligence')
  const now = hashOf(scopeSnapshot(m, d, 'return'))
  const signed = (level: string) => d.signoffs.some((s) => s.scope === 'return' && s.level === level && s.hash === now)
  const variance = varianceLines(m, d.standards.variance_review).filter((k) => !d.notes.some((n) => n.refs.includes(k)) && !d.verifications.has(k))

  return [
    { name: 'Engagement letter and consents signed', done: has('engagement_letter') && has('consent_7216'), detail: 'D01 and D02 are signed.', href: docHref('D01') },
    { name: 'Identity verified', done: m.packet.documents.filter((x) => x.document_type === 'identity_document' && x.received_at <= simNow).length >= 2, detail: 'Driver licenses on file for both spouses.', href: docHref('D04') },
    { name: 'Prior-year return reviewed', done: has('prior_year_return'), detail: 'The 2024 return and the prior preparer\'s file are in.', href: docHref('D06') },
    { name: 'All documents accounted for', done: loose === 0, detail: loose ? `${loose} document${loose > 1 ? 's' : ''} not used or only partly read.` : 'Every document landed or has a reason.', href: C('/documents') },
    { name: 'Prior-year variances explained', done: variance.length === 0, detail: variance.length ? `${variance.length} swing${variance.length > 1 ? 's' : ''} over the firm threshold ${variance.length > 1 ? 'have' : 'has'} no note.` : 'All swings explained.', href: schedulesHref('?r=variance') },
    { name: 'Carryovers agreed to prior year', done: carry.length > 0 && carryDone === carry.length, detail: `${carryDone} of ${carry.length} carryover lines verified.`, href: schedulesHref('?r=carryovers') },
    { name: 'Estimated payments agreed to IRS and FTB records', done: pay.every((f) => f.status !== 'open'), detail: pay.some((f) => f.status === 'open') ? 'Payments disagree with agency records.' : 'Agreed.', href: reviewHref() },
    { name: 'Due diligence completed', done: dd, detail: dd ? 'Form 8867 checklist recorded.' : 'Form 8867 for the child tax credit is not done.', href: reviewHref() },
    { name: 'Diagnostics resolved', done: open.length === 0, detail: open.length ? `${open.length} issue${open.length > 1 ? 's' : ''} still open.` : 'No open findings.', href: reviewHref() },
    { name: 'Reviewer sign-off', done: signed('reviewer'), detail: signed('reviewer') ? 'Signed and current.' : 'Not signed (or reopened by a change).' },
    { name: 'Partner sign-off', done: signed('partner'), detail: signed('partner') ? 'Signed and current.' : 'Not signed (or reopened by a change).' },
    {
      name: 'Client approval and e-file authorization',
      done: d.filing.clientApproval?.payload.hash === now,
      detail: !d.filing.clientApproval ? 'Form 8879 not yet signed.' : d.filing.clientApproval.payload.hash === now ? 'Signed by the client for this exact return.' : 'Stale: the return changed after the client signed.',
      href: filingHref(),
    },
  ]
}

/** Lines whose change from last year exceeds the firm's variance thresholds. */
export function varianceLines(m: Model, standard?: { flag_if_change_over_percent: number; and_over_amount: number }): string[] {
  const py = m.packet.prior_years.return_2024.lines
  const std = standard ?? m.packet.firm.starter_standards.variance_review
  return Object.keys(py).filter((k) => {
    const l = m.current.lines.get(k)
    if (!l || typeof l.value !== 'number') return false
    const diff = l.value - py[k]
    const pctOver = py[k] === 0 ? true : Math.abs(diff / py[k]) * 100 > std.flag_if_change_over_percent
    return Math.abs(diff) > std.and_over_amount && pctOver
  })
}
