// What the assistant always knows, sent with every question: who is asking, the
// season-clock date, the return's headline figures and status, the open issues
// (one line each), and what the person is looking at. Details come from tools.
import type { Actor } from '../../lib/rules/rules'
import type { ToolCtx } from './tools'
import { effectText } from './tools'
import { readiness } from '../readiness'
import { AREA_BY_ID } from '../../lib/packet/areas'
import { maskText } from '../Sensitive'
import { isOpenIssue } from '../findings'

export function buildContext(ctx: ToolCtx, me: Actor, where: { path: string; params: URLSearchParams }): string {
  const { m, d, findings, simNow } = ctx
  const sum = m.current.v.summary
  const e = d.totalEffect
  const fed = { tax: sum.federal.total_tax + e.fedTax, balance: sum.federal.balance_due + e.fedBalance }
  const ca = { tax: sum.california.total_tax + e.caTax, balance: sum.california.balance_due + e.caBalance }
  const money = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
  const bal = (n: number) => `${money(n)} ${n < 0 ? 'refund' : 'owed'}`
  const status = d.filing.amending ? 'amending a filed return' : d.filing.frozen ? 'filed (frozen)' : d.filing.clientApproval ? 'client approved, not yet filed' : 'in review'
  const hh = m.packet.household

  const out: string[] = []
  out.push(`Today on the season clock: ${simNow.slice(0, 10)}. Asking: ${me.name} (${me.role}).`)
  out.push(`Client: Okafor-Lindqvist household (${m.packet.packet.client_id}), tax year ${m.taxYear}, ${hh.filing_status.replace(/_/g, ' ')}. Residency: ${hh.residency.map((r) => `${r.state} ${r.from} to ${r.to} (${r.status})`).join('; ')}.`)
  out.push(`People: ${hh.people.map((p) => `${p.name} (${p.role}${p.occupation ? `, ${p.occupation}` : ''}) [household:${p.id}]`).join('; ')}.`)
  out.push(`Return status: ${status}. Current engine version ${m.current.v.version} (computed ${m.current.v.computed_at.slice(0, 10)}).`)

  if (me.role === 'client') {
    out.push(`Their figures with the firm's corrections: federal total tax ${money(fed.tax)}, ${bal(fed.balance)}; California total tax ${money(ca.tax)}, ${bal(ca.balance)}.`)
    const waiting = d.threads.filter((t) => t.to === 'client' && !t.answered)
    out.push(`Questions from the firm waiting for them: ${waiting.length ? waiting.map((t) => `"${t.messages[0]?.text}"`).join('; ') : 'none'}.`)
    return maskText(out.join('\n'))
  }

  out.push(`Engine figures: federal AGI ${money(sum.federal.agi)} [F1040.11], taxable income ${money(sum.federal.taxable_income)}, total tax ${money(sum.federal.total_tax)}, ${bal(sum.federal.balance_due)}; California AGI ${money(sum.california.ca_agi)}, total tax ${money(sum.california.total_tax)}, ${bal(sum.california.balance_due)}.`)
  out.push(`With adjustments so far (estimate): federal total tax ${money(fed.tax)}, ${bal(fed.balance)}; California total tax ${money(ca.tax)}, ${bal(ca.balance)}. ${d.adjustments.filter((a) => a.status !== 'rejected').length} adjustments recorded.`)

  const steps = readiness(m, d, findings, simNow)
  out.push(`Steps to filing: ${steps.filter((s) => s.done).length} of ${steps.length} done. Not done: ${steps.filter((s) => !s.done).map((s) => `${s.name} (${s.detail})`).join('; ') || 'none'}.`)
  out.push(`Firm standards: adjustments with a tax effect over $${d.standards.partner_threshold.toLocaleString('en-US')} need partner sign-off; review levels ${d.standards.review_levels.join(', ')}. Team: preparer ${ctx.name(m.packet.firm.assignment_at_start.preparer)}, reviewer ${ctx.name(m.packet.firm.assignment_at_start.reviewer)}, partner ${ctx.name(m.packet.firm.assignment_at_start.partner)}.`)

  const open = findings.filter(isOpenIssue)
  out.push(`\nOpen issues from the independent checks (${open.length}), biggest first. Judgment calls are alternatives the engine did not choose; their effect is what choosing them would cost. Use get_finding for detail:`)
  for (const f of open) out.push(`- [finding:${f.id}] ${f.severity}: ${f.title} (${AREA_BY_ID.get(f.area)?.label ?? f.area}; ${effectText(f.effect)}; lines ${f.lines.slice(0, 4).join(', ')})`)
  const notes = findings.filter((f) => f.status === 'open' && f.severity === 'info')
  if (notes.length) out.push(`Informational notes (not counted as issues): ${notes.map((f) => `[finding:${f.id}] ${f.title}`).join('; ')}.`)
  const done = findings.filter((f) => f.status !== 'open')
  if (done.length) out.push(`Issues already handled: ${done.map((f) => `[finding:${f.id}] ${f.status}`).join(', ')}.`)

  const p = where.params
  const look: string[] = [`page ${where.path}`]
  if (p.get('trace')) look.push(`line ${p.get('trace')} open in the trace panel`)
  if (p.get('focus')) look.push(`lineage of ${p.get('focus')} on the map`)
  if (p.get('f')) look.push(`issue finding:${p.get('f')}`)
  const doc = where.path.match(/\/documents\/(D\d{2})/)?.[1]
  if (doc) look.push(`document ${doc}${p.get('page') ? ` page ${p.get('page')}` : ''}`)
  if (p.get('area')) look.push(`area ${p.get('area')}`)
  out.push(`\nThe person is looking at: ${look.join('; ')}. "This", "here" or "it" likely means that.`)
  return maskText(out.join('\n'))
}
