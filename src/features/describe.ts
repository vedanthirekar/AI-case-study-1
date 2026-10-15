// One sentence for any workpaper event, for activity feeds and notifications.
import type { Model } from '../lib/packet/model'
import type { WPEvent, Payloads } from '../lib/workpaper/events'
import { fmtValue } from '../lib/format'

export function describe(e: WPEvent, m: Model, name: (id: string) => string): string {
  const who = name(e.actor)
  const line = (k?: string) => (k ? `${m.current.lines.get(k)?.label ?? k} (${k})` : '')
  switch (e.type) {
    case 'verification.recorded': { const p = e.payload as Payloads['verification.recorded']; return `${who} verified ${e.refs.map((r) => r.startsWith('finding:') ? 'a finding' : r).join(', ')}: ${p.method.replace(/_/g, ' ')}` }
    case 'adjustment.proposed': { const p = e.payload as Payloads['adjustment.proposed']; return `${who} proposed ${line(p.lineKey)}: ${fmtValue(p.from)} to ${fmtValue(p.to)}` }
    case 'adjustment.approved': return `${who} approved an adjustment to ${e.refs[0]}`
    case 'adjustment.rejected': return `${who} rejected an adjustment to ${e.refs[0]}`
    case 'finding.dismissed': { const p = e.payload as Payloads['finding.dismissed']; return `${who} dismissed a finding: ${p.reason}` }
    case 'note.created': { const p = e.payload as Payloads['note.created']; return `${who} ${p.blocking ? 'raised a blocking review note' : 'added a note'} on ${e.refs[0]}: "${p.text}"` }
    case 'note.resolved': return `${who} resolved a note on ${e.refs[0]}`
    case 'thread.message': { const p = e.payload as Payloads['thread.message']; return `${who} ${p.to === 'client' ? 'asked the client' : 'wrote to the firm'}: "${p.text}"` }
    case 'decision.recorded': { const p = e.payload as Payloads['decision.recorded']; return `${who} recorded a ${p.kind.replace('_', ' ')}: ${p.choice} (${p.authority})` }
    case 'signoff.given': { const p = e.payload as Payloads['signoff.given']; return `${who} signed off ${p.scope} as ${p.level}` }
    case 'sensitive.revealed': { const p = e.payload as Payloads['sensitive.revealed']; return `${who} revealed sensitive data: ${p.label}` }
    case 'attachment.added': { const p = e.payload as Payloads['attachment.added']; return `${who} attached ${p.name} to ${e.refs[0]}` }
    case 'assignment.set': { const p = e.payload as Payloads['assignment.set']; return `${who} assigned ${p.scope} to ${name(p.assignee)}${p.due ? `, due ${p.due}` : ''}` }
    case 'time.logged': { const p = e.payload as Payloads['time.logged']; return `${who} logged ${p.hours}h on ${p.area}` }
    case 'standard.changed': { const p = e.payload as Payloads['standard.changed']; return `${who} changed firm standard ${p.path}` }
    case 'filing.recorded': { const p = e.payload as Payloads['filing.recorded']; return `${who} recorded ${p.kind.replace('_', ' ')}${p.detail ? `: ${p.detail}` : ''}` }
    case 'event.reversed': return `${who} undid an earlier action`
  }
  return `${who}: ${e.type}`
}
