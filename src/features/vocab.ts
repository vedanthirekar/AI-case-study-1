// Every status vocabulary, defined once (DESIGN.md rule 7). Each renders through
// StatusBadge and is explained by a StatusLegend in the app.
import type { Vocab } from '../components/StatusBadge'

/** A return line's review state. Confidence is never part of this (rule 9). */
export const LINE_STATE: Vocab = {
  unverified: { label: 'Unverified', tone: 'muted', icon: 'eye', desc: 'Computed by the engine; no person has checked it yet.' },
  verified: { label: 'Verified', tone: 'good', icon: 'check', desc: 'A person agreed it to its source and recorded how.' },
  adjusted: { label: 'Adjusted', tone: 'accent', icon: 'edit', desc: 'Changed by an adjustment; the original value is kept.' },
  flagged: { label: 'Flagged', tone: 'warn', icon: 'alert', desc: 'An independent check disagrees with the engine.' },
  blocking: { label: 'Blocks filing', tone: 'danger', icon: 'lock', desc: 'Has an open blocking review note.' },
}

export const SEVERITY: Vocab = {
  error: { label: 'Error', tone: 'danger', icon: 'alert', desc: 'The return is wrong as computed.' },
  warning: { label: 'Warning', tone: 'warn', icon: 'alert', desc: 'Likely wrong or missing support; needs a person.' },
  judgment: { label: 'Judgment', tone: 'ai', icon: 'scale', desc: 'A choice with a tax effect; record the decision and authority.' },
  info: { label: 'Info', tone: 'muted', icon: 'help', desc: 'Context to confirm; no change expected.' },
}

export const FINDING_STATUS: Vocab = {
  open: { label: 'Open', tone: 'warn', icon: 'alert', desc: 'Nobody has acted on it yet.' },
  proposed: { label: 'Adjustment proposed', tone: 'accent', icon: 'edit', desc: 'An adjustment was proposed and awaits approval.' },
  resolved: { label: 'Resolved', tone: 'good', icon: 'check', desc: 'Adjusted and approved, or a decision was recorded.' },
  dismissed: { label: 'Dismissed', tone: 'muted', icon: 'x', desc: 'A person judged it not an issue and recorded why.' },
}

export const ADJ_STATUS: Vocab = {
  proposed: { label: 'Awaiting approval', tone: 'warn', icon: 'clock', desc: 'Proposed; a reviewer (or the partner, over 1,000 tax effect) must approve.' },
  approved: { label: 'Approved', tone: 'good', icon: 'check', desc: 'Approved by someone other than the person who proposed it.' },
  rejected: { label: 'Rejected', tone: 'danger', icon: 'x', desc: 'Rejected with a note; the original value stands.' },
}

export const DOC_STATUS: Vocab = {
  used: { label: 'Used', tone: 'good', icon: 'check', desc: 'Its values feed lines of the current return.' },
  evidence: { label: 'Evidence', tone: 'accent', icon: 'link', desc: 'Not on any line, but an independent check relies on it (for example a paystub that splits wages by state).' },
  record: { label: 'Record', tone: 'muted', icon: 'book', desc: 'Kept as support (engagement, identity, prior year, agency); no return lines expected.' },
  superseded: { label: 'Superseded', tone: 'muted', icon: 'history', desc: 'Replaced by a corrected document.' },
  duplicate: { label: 'Duplicate', tone: 'muted', icon: 'columns', desc: 'Another image of a document already counted.' },
  partial: { label: 'Partly read', tone: 'warn', icon: 'alert', desc: 'Some pages were never read by the pipeline.' },
  unused: { label: 'Not used', tone: 'warn', icon: 'alert', desc: 'Received but nothing on the return comes from it. Needs a reason.' },
  pending: { label: 'Not yet received', tone: 'muted', icon: 'clock', desc: 'Arrives later on the season clock.' },
}

export const SIGNOFF_STATE: Vocab = {
  none: { label: 'Not signed', tone: 'muted', icon: 'eye', desc: 'Nobody has signed off this area.' },
  signed: { label: 'Signed', tone: 'good', icon: 'check-double', desc: 'Signed, and nothing has changed since.' },
  reopened: { label: 'Reopened', tone: 'ai', icon: 'refresh', desc: 'Something changed after the sign-off; it must be signed again.' },
}
