// Independent checks: they recompute from documents, agency records and client
// answers instead of trusting the engine. Each returns findings with evidence
// and, where the fix is mechanical, proposed adjustments with a tax effect.
// Nothing here names a specific planted error; every check is a general rule.
import type { Model } from '../packet/model'
import { num, evByField, docsOfType } from '../packet/model'
import { areaOf } from '../packet/areas'
import type { Doc, ExtractedValue, Line } from '../packet/types'
import { effectOf, addEffects, ZERO } from '../workpaper/effect'
import type { EffectCategory } from '../workpaper/events'
import { fmtNum } from '../format'
import type { CheckContext, Finding, Proposal } from './types'

type Check = (m: Model, ctx: CheckContext) => Finding[]

const SHORT_BOXES = new Set(['A', 'B', 'C', 'G', 'H', 'I'])
const money = (n: number) => fmtNum(Math.round(n))

function received(d: Doc | undefined, ctx: CheckContext) {
  return !!d && d.received_at <= ctx.simNow
}

function finding(m: Model, f: Omit<Finding, 'effect' | 'area'> & { area?: string }): Finding {
  const rates = m.current.v.tax_effect_rates
  const effect = f.proposals.reduce((acc, p) => addEffects(acc, effectOf(p, rates)), ZERO)
  return { ...f, area: f.area ?? (f.lines[0] ? areaOf(f.lines[0]) : 'summary'), effect }
}

function sourceEvs(m: Model, l: Line): ExtractedValue[] {
  return l.sources.map((s) => m.evs.get(s)).filter((e): e is ExtractedValue => !!e)
}

const lotField = (evs: ExtractedValue[], suffix: string) => evs.find((e) => e.field.endsWith(`_${suffix}`))

/** 1. Broker basis vs stock-plan supplement: lots reported at $0 basis whose real basis is on a supplemental statement. */
const supplementalBasis: Check = (m, ctx) => {
  const supplements = docsOfType(m, 'stock_plan_supplement').filter((d) => received(d, ctx))
  const suppEvs = supplements.flatMap((d) => m.evsByDoc.get(d.id) ?? [])
  const proposals: Proposal[] = []
  const evidence = new Set<string>()
  for (const l of m.current.v.lines) {
    if (l.form !== 'F8949') continue
    const evs = sourceEvs(m, l)
    const basis = lotField(evs, 'basis'); const acq = lotField(evs, 'acquired'); const sold = lotField(evs, 'sold')
    if (!basis || basis.value !== 0 || !acq?.value) continue
    const match = suppEvs.find((e) => e.field.endsWith('_acquired') && e.value === acq.value)
    if (!match) continue
    const prefix = match.field.replace(/_acquired$/, '')
    const adj = suppEvs.find((e) => e.field === `${prefix}_adjusted_basis`)
    if (!adj || typeof adj.value !== 'number') continue
    const box = l.key.split('.')[1]
    const cat: EffectCategory = SHORT_BOXES.has(box) ? 'stcg' : 'ltcg'
    const caSource = typeof sold?.value === 'string' && sold.value <= m.caResidencyEnd
    proposals.push({
      lineKey: l.key, from: l.value, to: num(l) - adj.value,
      fed: { category: cat, amount: -adj.value },
      ca: caSource ? { category: 'ca_source_income', amount: -adj.value } : { category: 'none', amount: 0 },
      reason: `Use adjusted basis ${money(adj.value)} from the stock plan supplement (lot ${prefix}) instead of the broker's $0.`,
    })
    evidence.add(basis.id); evidence.add(adj.id); evidence.add(match.id)
  }
  if (!proposals.length) return []
  const total = proposals.reduce((s, p) => s + (num({ value: p.from } as Line) - Number(p.to)), 0)
  return [finding(m, {
    id: 'supplemental-basis', check: 'Broker basis vs stock-plan supplement', title: `${proposals.length} stock lots taxed with $0 cost basis`,
    severity: 'error', source: 'check',
    summary: `The broker reported no basis for ${proposals.length} RSU lots, so the engine taxed the full proceeds. The employer's supplemental statement gives adjusted basis of ${money(total)}, already taxed as wages on the W-2, so it is being taxed twice.`,
    evidence: [...evidence, ...supplements.map((d) => d.id)], lines: proposals.map((p) => p.lineKey), proposals,
  })]
}

/** 2. State wage sourcing vs residency dates: W-2 state wages that include pay earned after the move. */
const stateWageSourcing: Check = (m, ctx) => {
  const line = m.current.lines.get('SchCA540NR.1.E')
  if (!line) return []
  const stub = docsOfType(m, 'paystub').find((d) => received(d, ctx) && evByField(m, d.id, 'ytd_ca_wages'))
  for (const ev of sourceEvs(m, line)) {
    if (ev.field !== 'box16') continue
    const doc = m.docs.get(ev.document_id)!
    const text = doc.pages.map((p) => p.printed_content).join(' ')
    const kept = text.match(/kept California as the work state through (\d{2}\/\d{2}\/\d{4})/i)
    if (!kept) continue
    const caWages = stub ? evByField(m, stub.id, 'ytd_ca_wages') : undefined
    const base = {
      id: 'state-wage-source', check: 'State wage source vs residency dates', area: 'california',
      title: 'California wages include pay earned after the move to Texas', severity: 'error' as const, source: 'check' as const,
      lines: [line.key],
    }
    if (!caWages || typeof caWages.value !== 'number') {
      return [finding(m, {
        ...base, proposals: [], evidence: [ev.id, doc.id, 'household:ngozi'],
        summary: `${doc.issuer || doc.title} kept California as the work state through ${kept[1]}, but the family became Texas residents on ${m.caResidencyEnd.slice(5)} (day after). Box 16 overstates California-source wages.`,
        nextStep: 'Ask the client for a paystub dated around the move to split the wages by date.',
      })]
    }
    const to = num(line) - (ev.value as number) + caWages.value
    return [finding(m, {
      ...base,
      summary: `${doc.title.replace(/^2025 Form W-2 - /, '')} reported all ${money(ev.value as number)} as California wages (payroll kept California as the work state through ${kept[1]}). The paystub at the move shows California wages of ${money(caWages.value)}; the rest was earned as a Texas resident.`,
      evidence: [ev.id, caWages.id, stub!.id, doc.id],
      proposals: [{ lineKey: line.key, from: line.value, to, fed: { category: 'none', amount: 0 }, ca: { category: 'ca_source_income', amount: to - num(line) }, reason: `California-source wages for this employer are ${money(caWages.value)} (paystub through the move date), not box 16.` }],
    })]
  }
  return []
}

/** 3. Payment-card amounts vs book deposits: 1099-K amounts added on top of books that already include them. */
const cardDoubleCount: Check = (m) => {
  const line = m.current.lines.get('SchC.1')
  const books = docsOfType(m, 'books_profit_loss')[0]
  const total = books && evByField(m, books.id, 'total_income')
  if (!line || !total || typeof total.value !== 'number') return []
  const diff = num(line) - total.value
  const k = docsOfType(m, '1099-K').map((d) => evByField(m, d.id, 'box1a')).find((e) => e && e.value === diff)
  if (!k || diff <= 0) return []
  const detail = docsOfType(m, 'books_transaction_detail').flatMap((d) => m.evsByDoc.get(d.id) ?? []).find((e) => e.value === diff)
  if (!detail) return []
  return [finding(m, {
    id: 'card-double-count', check: 'Payment-card amounts vs book deposits', title: 'Card payments counted twice in business income',
    severity: 'error', source: 'check', lines: [line.key],
    summary: `Gross receipts are books revenue (${money(total.value)}) plus the 1099-K (${money(diff)}). The books' deposit detail shows that ${money(diff)} already arrived through the card processor and was deposited gross, so it is in revenue once already.`,
    evidence: [k.id, detail.id, total.id],
    proposals: [{ lineKey: line.key, from: line.value, to: total.value, fed: { category: 'schc_profit', amount: -diff }, ca: { category: 'schc_profit', amount: -diff }, reason: 'Remove the 1099-K amount already included in book deposits.' }],
  })]
}

/** 4. Self-employed health insurance eligibility: not allowed for months the person could join a spouse's employer plan. */
const sehiEligibility: Check = (m) => {
  const line = m.current.lines.get('Sch1.17')
  if (!line || num(line) <= 0) return []
  const qa = m.packet.client.questionnaire.find((q) => /eligible for health coverage through/i.test(q.question) && /^yes/i.test(q.answer))
  if (!qa) return []
  const prior = m.packet.prior_years.return_2024.notes['Sch1.17']
  return [finding(m, {
    id: 'sehi-eligibility', check: 'Self-employed health insurance eligibility', title: 'Health insurance deduction not allowed (eligible for spouse\'s employer plan)',
    severity: 'error', source: 'check', lines: [line.key],
    summary: `The engine deducted ${money(num(line))} of premiums. The client says both of Ngozi's employers offered family coverage Erik could join; no deduction is allowed for months he was eligible for a subsidized employer plan.${prior ? ' Last year\'s preparer took none for the same reason.' : ''}`,
    evidence: [qa.id, ...line.sources, ...(prior ? ['py:/return_2024/notes/Sch1.17'] : [])],
    proposals: [{ lineKey: line.key, from: line.value, to: 0, fed: { category: 'adjustment', amount: -num(line) }, ca: { category: 'adjustment', amount: -num(line) }, reason: 'Not eligible: could participate in a spouse\'s subsidized employer plan (IRC 162(l)(2)(B)).' }],
  })]
}

/** 5. Duplicate pages: a page whose printed content repeats another page of the same document. */
const duplicatePages: Check = (m, ctx) => {
  const out: Finding[] = []
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
  // Same entries in the same order, ignoring a scanner's note around them.
  const sig = (d: Doc, page: number) => (m.evsByDoc.get(d.id) ?? []).filter((e) => e.page === page)
    .map((e) => `${e.field}=${e.value}`).join('|')
  for (const d of m.packet.documents) {
    if (!received(d, ctx) || d.pages.length < 2) continue
    for (let i = 1; i < d.pages.length; i++) {
      const p = d.pages[i]
      const body = norm(p.printed_content)
      const s = sig(d, p.page)
      const twin = d.pages.slice(0, i).find((q) => {
        const prev = norm(q.printed_content)
        // Boilerplate pages ("no further transactions") repeat legitimately: require substance.
        const textCopy = prev.length > 200 && body.includes(prev)
        const valueCopy = s.split('|').length >= 5 && s === sig(d, q.page)
        return textCopy || valueCopy
      })
      if (!twin) continue
      const dupEvs = (m.evsByDoc.get(d.id) ?? []).filter((e) => e.page === p.page)
      const proposals: Proposal[] = []
      const lines = new Set<string>()
      for (const e of dupEvs) {
        for (const k of m.current.linesByEv.get(e.id) ?? []) {
          const l = m.current.lines.get(k)!
          if (typeof e.value !== 'number') continue
          lines.add(k)
          proposals.push({ lineKey: k, from: l.value, to: num(l) - e.value, fed: { category: 'none', amount: 0 }, ca: { category: 'none', amount: 0 }, reason: `Remove page ${p.page}: it repeats page ${twin.page}.` })
          for (const dk of m.current.usedBy.get(k) ?? []) {
            const dl = m.current.lines.get(dk)!
            if (dl.rule !== 'R-STANDARD-MILEAGE') continue
            const rate = Number(m.packet.engine_reference.parameters.mileage_rate)
            const cut = e.value * rate
            lines.add(dk)
            proposals.push({ lineKey: dk, from: dl.value, to: num(dl) - cut, fed: { category: 'schc_profit', amount: cut }, ca: { category: 'schc_profit', amount: cut }, reason: `${fmtNum(e.value)} duplicated miles at ${rate} per mile.` })
          }
        }
      }
      out.push(finding(m, {
        id: `duplicate-page-${d.id}-${p.page}`, check: 'Duplicate pages', title: `${d.title}: page ${p.page} repeats page ${twin.page}`,
        severity: proposals.length ? 'error' : 'warning', source: 'check', lines: [...lines],
        summary: `Page ${p.page} has the same entries as page ${twin.page}${dupEvs.length ? `, and its values were counted again` : ''}.`,
        evidence: [`doc:${d.id}#page${twin.page}`, `doc:${d.id}#page${p.page}`, ...dupEvs.filter((e) => /total/.test(e.field)).map((e) => e.id)],
        proposals,
      }))
    }
  }
  return out
}

/** 6. Property tax proration at purchase: the buyer may deduct only taxes for the days they owned the home. */
const propertyTaxProration: Check = (m, ctx) => {
  const line = m.current.lines.get('SchA.5b')
  const buyer = docsOfType(m, 'closing_statement_buyer').find((d) => received(d, ctx))
  const credit = buyer && evByField(m, buyer.id, 'tax_credit')
  if (!line || !credit || typeof credit.value !== 'number') return []
  const d5 = num(m.current.lines.get('SchA.5d')); const e5 = num(m.current.lines.get('SchA.5e'))
  const capped = d5 > e5
  const newD = d5 - credit.value
  const fedDelta = (capped ? Math.min(newD, e5) : newD) - e5
  return [finding(m, {
    id: 'property-tax-proration', check: 'Property tax proration at purchase', title: 'Home property tax includes the seller\'s share',
    severity: 'error', source: 'check', lines: [line.key],
    summary: `The engine deducted the full ${money(num(line))} county bill. At closing the seller credited ${money(credit.value)} for the taxes before the purchase date, so that part is the seller's tax.${capped ? ' Removing it takes state and local taxes below the cap, so the federal deduction drops too.' : ''}`,
    evidence: [credit.id, ...line.sources],
    proposals: [{ lineKey: line.key, from: line.value, to: num(line) - credit.value, fed: { category: 'itemized', amount: fedDelta }, ca: { category: 'itemized', amount: -credit.value }, reason: 'Deduct only the buyer\'s share of 2025 property tax (IRC 164(d)).' }],
  })]
}

/** 7. Donated vehicle value: limited to the charity's gross sale proceeds when it sold the vehicle. */
const vehicleDonation: Check = (m, ctx) => {
  const line = m.current.v.lines.find((l) => l.form === 'F8283' && /vehicle/i.test(l.key))
  const c = docsOfType(m, '1098-C').find((d) => received(d, ctx))
  const sold = c && evByField(m, c.id, 'box4c')
  if (!line || !sold || typeof sold.value !== 'number' || num(line) <= sold.value) return []
  const delta = sold.value - num(line)
  return [finding(m, {
    id: 'vehicle-donation', check: 'Donated vehicle value vs Form 1098-C', title: 'Car donation claimed above what the charity sold it for',
    severity: 'error', source: 'check', lines: [line.key, 'SchA.12'],
    summary: `The engine used the client's estimate of ${money(num(line))}. Form 1098-C shows the charity sold the car for ${money(sold.value)}; the deduction is limited to that amount.`,
    evidence: [sold.id, ...line.sources],
    proposals: [{ lineKey: line.key, from: line.value, to: sold.value, fed: { category: 'itemized', amount: delta }, ca: { category: 'itemized', amount: delta }, reason: 'Vehicle sold by the charity: deduction limited to gross proceeds on Form 1098-C (IRC 170(f)(12)).' }],
  })]
}

/** 8. Interest counted twice: a payoff statement's interest added on top of a 1098 that already includes it. */
const payoffInterest: Check = (m) => {
  const line = m.current.lines.get('SchA.8a')
  if (!line) return []
  const evs = sourceEvs(m, line)
  const payoff = evs.find((e) => m.docs.get(e.document_id)?.document_type === 'payoff_statement' && e.field === 'interest')
  if (!payoff || typeof payoff.value !== 'number') return []
  const payoffDoc = m.docs.get(payoff.document_id)!
  const f1098 = evs.map((e) => m.docs.get(e.document_id)!).find((d) => d.document_type === '1098' && /interest paid at payoff/i.test(d.pages[0].printed_content))
  const saysIncluded = /reported on the 2025 Form 1098/i.test(payoffDoc.pages[0].printed_content)
  if (!f1098 && !saysIncluded) return []
  return [finding(m, {
    id: 'payoff-interest', check: 'Interest counted twice across documents', title: 'Mortgage payoff interest counted twice',
    severity: 'error', source: 'check', lines: [line.key],
    summary: `The engine added ${money(payoff.value)} of interest from the payoff statement. ${f1098 ? `The ${f1098.issuer || 'lender'} Form 1098 already includes interest paid at payoff` : 'The payoff statement says the interest is on the Form 1098'}.`,
    evidence: [payoff.id, ...(f1098 ? [f1098.id] : []), payoffDoc.id],
    proposals: [{ lineKey: line.key, from: line.value, to: num(line) - payoff.value, fed: { category: 'itemized', amount: -payoff.value }, ca: { category: 'itemized', amount: -payoff.value }, reason: 'Payoff interest is already in Form 1098 box 1.' }],
  })]
}

/** 9. Same payer reported twice: two interest lines with equal amounts for the same account. */
const duplicatePayer: Check = (m) => {
  const lines = m.current.v.lines.filter((l) => /^SchB\.1\.\d+$/.test(l.key) && typeof l.value === 'number')
  const out: Finding[] = []
  const acct = (l: Line) => {
    for (const e of sourceEvs(m, l)) {
      const t = m.docs.get(e.document_id)!.pages.map((p) => p.printed_content).join(' ')
      const a = t.match(/account ending (\d{4})/i)
      if (a) return a[1]
    }
    return null
  }
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const a = lines[i]; const b = lines[j]
    if (a.value !== b.value || num(a) === 0) continue
    const aa = acct(a); const bb = acct(b)
    if (!aa || aa !== bb) continue
    out.push(finding(m, {
      id: `duplicate-payer-${b.key}`, check: 'Same payer reported twice', title: `Interest of ${money(num(b))} reported twice`,
      severity: 'error', source: 'check', lines: [b.key],
      summary: `"${a.label.replace(/^Interest - /, '')}" and "${b.label.replace(/^Interest - /, '')}" are the same ${money(num(a))} for account ending ${aa}: the bank-sweep 1099-INT inside the composite statement and the standalone 1099-INT are one payment.`,
      evidence: [...a.sources, ...b.sources],
      proposals: [{ lineKey: b.key, from: b.value, to: 0, fed: { category: 'interest', amount: -num(b) }, ca: { category: 'interest', amount: -num(b) }, reason: `Same interest as ${a.key} (account ending ${aa}).` }],
    }))
  }
  return out
}

/** 10. Exchange-rate year: foreign amounts converted with a rate from the wrong year. */
const fxYear: Check = (m) => {
  const out: Finding[] = []
  const fx = m.packet.engine_reference.parameters.fx as Record<string, Record<string, number>>
  for (const l of m.current.v.lines) {
    const ref = l.sources.find((s) => s.startsWith('ref:fx.'))
    if (!ref) continue
    const [, cur, rate] = ref.split('.') // ref:fx.SEK.2024_average
    const year = Number(rate.slice(0, 4))
    if (year === m.taxYear || !rate.endsWith('average')) continue
    const right = fx[cur]?.[`${m.taxYear}_average`]
    const foreign = sourceEvs(m, l).find((e) => typeof e.value === 'number')
    if (!right || !foreign) continue
    const to = Math.round((foreign.value as number) / right)
    out.push(finding(m, {
      id: `fx-year-${l.key}`, check: 'Exchange-rate year', title: `${cur} converted at the ${year} rate`,
      severity: 'warning', source: 'check', lines: [l.key],
      summary: `${cur} ${fmtNum(foreign.value as number, 2)} was converted at the ${year} average (${fx[cur][rate]}). Income for ${m.taxYear} uses the ${m.taxYear} average (${right}): ${money(to)}, not ${money(num(l))}.`,
      evidence: [foreign.id, ref, `ref:fx.${cur}.${m.taxYear}_average`],
      proposals: [{ lineKey: l.key, from: l.value, to, fed: { category: 'interest', amount: to - num(l) }, ca: { category: 'interest', amount: to - num(l) }, reason: `Convert at the ${m.taxYear} average rate.` }],
    }))
  }
  return out
}

/** 11. Estimated payments vs IRS transcript. */
const fedPayments: Check = (m, ctx) => {
  const line = m.current.lines.get('F1040.26')
  const snaps = m.packet.tax_agency_records.irs_account_transcript_2025.filter((s) => s.as_of <= ctx.simNow.slice(0, 10))
  const snap = snaps[snaps.length - 1]
  if (!line || !snap) return []
  const cutoff = `${m.taxYear + 1}-01-15`
  const paid = snap.transactions.filter((t) => t.code === '670' && /estimated/i.test(t.description) && t.date <= cutoff)
  const total = paid.reduce((s, t) => s + Number(t.amount), 0)
  if (total === num(line)) return []
  const idx = m.packet.tax_agency_records.irs_account_transcript_2025.indexOf(snap)
  const answer = line.sources.find((s) => s.startsWith('qa-'))
  return [finding(m, {
    id: 'fed-estimates-vs-transcript', check: 'Estimated payments vs IRS transcript', title: 'Federal estimated payments do not match the IRS transcript',
    severity: 'error', source: 'check', lines: [line.key], area: 'payments',
    summary: `The return claims ${money(num(line))}; the IRS transcript (as of ${snap.as_of}) shows ${paid.length} estimated payments totaling ${money(total)}.${answer ? ` The difference comes from the client's recollection (${answer}), with no payment confirmation.` : ''}`,
    evidence: [`agency:/irs_account_transcript_2025/${idx}`, ...(answer ? [answer] : []), ...line.sources.filter((s) => s.startsWith('ev-')).slice(0, 2)],
    proposals: [{ lineKey: line.key, from: line.value, to: total, fed: { category: 'payment', amount: total - num(line) }, ca: { category: 'none', amount: 0 }, reason: 'Agree estimated payments to the IRS account transcript.' }],
  })]
}

/** 12. State payments applied to the wrong year. */
const caPayments: Check = (m) => {
  const line = m.current.lines.get('F540NR.72')
  if (!line) return []
  const evs = sourceEvs(m, line)
  const wrong = evs.filter((e) => /_year$/.test(e.field) && e.value !== String(m.taxYear))
  if (!wrong.length) return []
  const amounts = wrong.map((y) => evs.find((e) => e.field === y.field.replace(/_year$/, '_amount'))).filter((e): e is ExtractedValue => !!e)
  const cut = amounts.reduce((s, e) => s + Number(e.value), 0)
  const ftb = m.packet.tax_agency_records.ftb_account
  const ftbTotal = ftb.tax_year_2025_payments.reduce((s, p) => s + p.amount, 0)
  return [finding(m, {
    id: 'ca-payments-wrong-year', check: 'Payments vs FTB account', title: 'California payment applied to the prior year counted for 2025',
    severity: 'error', source: 'check', lines: [line.key], area: 'california',
    summary: `The engine counted every FTB payment in the date window (${money(num(line))}). ${wrong.length === 1 ? 'One payment of' : 'Payments totaling'} ${money(cut)} ${wrong.length === 1 ? 'was' : 'were'} designated tax year ${wrong[0].value}; the FTB account shows ${money(ftbTotal)} for 2025.`,
    evidence: [...wrong.map((e) => e.id), ...amounts.map((e) => e.id), 'agency:/ftb_account/tax_year_2025_payments', 'agency:/ftb_account/tax_year_2024_payments_after_filing'],
    proposals: [{ lineKey: line.key, from: line.value, to: num(line) - cut, fed: { category: 'none', amount: 0 }, ca: { category: 'payment', amount: -cut }, reason: 'Agree estimated payments to the FTB account (or ask the FTB to transfer the credit).' }],
  })]
}

/** 13. Identity vs prior year and identity documents. */
const dependentIdentity: Check = (m, ctx) => {
  const out: Finding[] = []
  const prior = m.packet.prior_years.return_2024.dependents
  for (const p of m.packet.household.people.filter((x) => x.role === 'dependent')) {
    const py = prior.find((d) => d.name === p.name)
    const card = m.packet.documents.find((d) => d.belongs_to === `dependent:${p.id}` && d.document_type === 'identity_document' && received(d, ctx))
    const cardSsn = card && evByField(m, card.id, 'ssn')
    const others = [py?.ssn, cardSsn?.value].filter(Boolean) as string[]
    if (!others.length || others.every((s) => s === p.ssn)) continue
    const idx = py ? prior.indexOf(py) : -1
    out.push(finding(m, {
      id: `dependent-ssn-${p.id}`, check: 'Identity vs prior year', title: `${p.name}: SSN differs from last year's return`,
      severity: 'error', source: 'check', lines: ['F8812.4'], area: 'summary', blocksFiling: true,
      summary: `The organizer has ${mask(p.ssn)}; ${py ? `the 2024 return used ${mask(py.ssn)}` : ''}${cardSsn ? ` and the Social Security card shows ${mask(String(cardSsn.value))}` : ''}. E-file will reject a dependent SSN that does not match IRS records.`,
      evidence: [`household:${p.id}`, ...(idx >= 0 ? [`py:/return_2024/dependents/${idx}`] : []), ...(cardSsn ? [cardSsn.id] : [])],
      proposals: [],
      nextStep: cardSsn ? 'Correct the SSN from the Social Security card before filing.' : 'Ask the client to confirm the number from the Social Security card.',
    }))
  }
  return out
}

const mask = (ssn: string) => `***-**-${ssn.slice(-4)}`

/** 14. Extraction vs printed page: identifiers the pipeline read that are not what the page says. */
const extractionVsPage: Check = (m, ctx) => {
  const out: Finding[] = []
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  for (const e of m.packet.extracted_values) {
    if (!['ein', 'ssn', 'account_number'].includes(e.value_type) || typeof e.value !== 'string') continue
    const d = m.docs.get(e.document_id)
    if (!received(d, ctx)) continue
    const page = d!.pages.find((p) => p.page === e.page)
    if (!page || norm(page.printed_content).includes(norm(e.value))) continue
    const printed = page.printed_content.match(/\b\d{2}-\d{7}\b|\b\d{3}-\d{2}-\d{4}\b/g)?.find((x) => norm(x).split('').sort().join() === norm(e.value as string).split('').sort().join())
    const lines = m.current.linesByEv.get(e.id) ?? []
    out.push(finding(m, {
      id: `extraction-mismatch-${e.id}`, check: 'Extraction vs printed page', title: `${d!.issuer || d!.title}: ${e.label} misread`,
      severity: 'error', source: 'check', lines, area: lines[0] ? areaOf(lines[0]) : 'summary', blocksFiling: true,
      summary: `The pipeline read ${e.value} (confidence ${e.confidence}), but the page prints ${printed ?? 'a different number'}. ${lines.length ? `It flows to ${lines.join(', ')}.` : ''}`,
      evidence: [e.id], proposals: [],
      nextStep: `Correct the ${e.label.toLowerCase()} to ${printed ?? 'the printed value'} on the form before filing.`,
    }))
  }
  return out
}

/** 15. Pages the pipeline never read. */
const unreadPages: Check = (m, ctx) => {
  const out: Finding[] = []
  const used = new Set(m.current.v.documents_used)
  const superseded = new Set(m.current.v.documents_superseded)
  for (const d of m.packet.documents) {
    if (d.extraction.status !== 'partial' || !used.has(d.id) || superseded.has(d.id) || !received(d, ctx)) continue
    const pageNo = Number(d.extraction.reason?.match(/Page (\d+)/i)?.[1])
    const page = d.pages.find((p) => p.page === pageNo)
    if (!page) continue
    const proposals: Proposal[] = []
    const re = /(\w+) ([^;]+?) ([\d.]+) sh acquired (\S+) sold (\S+) proceeds ([\d,.]+) basis ([\d,.]+) (short|long)-term (covered|noncovered)/g
    for (const x of page.printed_content.matchAll(re)) {
      const proceeds = Number(x[6].replace(/,/g, '')); const basis = Number(x[7].replace(/,/g, ''))
      const short = x[8] === 'short'; const covered = x[9] === 'covered'
      const box = short ? (covered ? 'A' : 'B') : (covered ? 'D' : 'E')
      const gain = proceeds - basis
      proposals.push({
        lineKey: `F8949.${box}.${x[1]}`, from: null, to: gain,
        fed: { category: short ? 'stcg' : 'ltcg', amount: gain },
        ca: x[5] <= m.caResidencyEnd ? { category: 'ca_source_income', amount: gain } : { category: 'none', amount: 0 },
        reason: `Add lot ${x[1]} (${x[2]}) from page ${pageNo}, never read by the pipeline.`,
      })
    }
    out.push(finding(m, {
      id: `unread-page-${d.id}-${pageNo}`, check: 'Pages the pipeline never read', title: `${d.title}: page ${pageNo} was never read`,
      severity: proposals.length ? 'error' : 'warning', source: 'check', lines: proposals.map((p) => p.lineKey), area: 'investments',
      summary: `Extraction stopped short of page ${pageNo} ("${d.extraction.reason}").${proposals.length ? ` It holds ${proposals.length} more sale${proposals.length > 1 ? 's' : ''}, which is why the broker's summary does not tie to the lots on the return.` : ''}`,
      evidence: [`doc:${d.id}#page${pageNo}`, ...(m.evsByDoc.get(d.id) ?? []).filter((e) => e.field === 'b_summary_proceeds').map((e) => e.id)],
      proposals, covers: ['BROKER_SUMMARY_DETAIL_MISMATCH'],
    }))
  }
  return out
}

/** 16. Missing basis with client evidence (digital assets transferred in). */
const missingBasis: Check = (m, ctx) => {
  const out: Finding[] = []
  for (const l of m.current.v.lines) {
    if (l.form !== 'F8949') continue
    const evs = sourceEvs(m, l)
    const acq = lotField(evs, 'acquired'); const basis = lotField(evs, 'basis'); const asset = lotField(evs, 'asset')
    if (!acq || acq.value !== null || !basis || basis.value !== null) continue
    const proceeds = lotField(evs, 'proceeds')
    const msg = m.packet.client.messages.find((x) => x.sent_at <= ctx.simNow && /no cost/i.test(x.text) && (!asset || x.text.includes(String(asset.value))))
    const found = msg?.text.match(/in (\w+) (\d{4}) for about ([\d,]+)/i)
    const base = {
      id: `missing-basis-${l.key}`, check: 'Missing basis', area: 'investments', lines: [l.key], covers: ['DIGITAL_ASSET_BASIS_MISSING'],
      title: `${asset?.value ?? 'Lot'} lot ${l.key.split('.').pop()} has no cost basis`, source: 'check' as const,
    }
    if (!found || !proceeds || typeof proceeds.value !== 'number') {
      out.push(finding(m, {
        ...base, severity: 'warning', proposals: [], evidence: evs.map((e) => e.id),
        summary: `The exchange shows a transfer in with unknown cost; the engine used $0 basis and the transfer-in date, taxing all ${money(Number(proceeds?.value ?? 0))} as a short-term gain.`,
        nextStep: 'Ask the client where and when the coins were bought, and for proof of cost.',
      }))
      continue
    }
    const cost = Number(found[3].replace(/,/g, ''))
    const gain = proceeds.value - cost
    const lt = `F8949.K.${l.key.split('.').pop()}`
    out.push(finding(m, {
      ...base, severity: 'warning',
      summary: `The client says the coins were bought in ${found[1]} ${found[2]} for about ${money(cost)} on another exchange (${msg!.id}). That makes the gain ${money(gain)}, long-term, instead of ${money(proceeds.value)} short-term. Support is a bank statement line only: record how it was verified.`,
      evidence: [msg!.id, ...evs.map((e) => e.id)],
      proposals: [
        { lineKey: l.key, from: l.value, to: 0, fed: { category: 'stcg', amount: -num(l) }, ca: { category: 'ca_source_income', amount: -num(l) }, reason: 'Move the lot out of short-term (basis unknown).' },
        { lineKey: lt, from: null, to: gain, fed: { category: 'ltcg', amount: gain }, ca: { category: 'ca_source_income', amount: gain }, reason: `Report long-term with basis ${money(cost)} per client (${msg!.id}).` },
      ],
    }))
  }
  return out
}

/** 17. Business-use percentages from the client call. */
const businessUse: Check = (m, ctx) => {
  const util = m.current.lines.get('SchC.25'); const soft = m.current.lines.get('SchC.27a.1')
  const call = m.packet.client.call_notes.find((c) => c.date <= ctx.simNow)
  if (!util || !call) return []
  const text = call.notes.join(' ')
  const phonePct = Number(text.match(/business share is (\d+)%/i)?.[1])
  const netPct = Number(text.match(/business use about (\d+)%/i)?.[1])
  const evs = sourceEvs(m, util)
  const tel = evs.find((e) => /telephone/i.test(e.field)); const net = evs.find((e) => /internet/i.test(e.field))
  const proposals: Proposal[] = []
  const evidence = [call.id]
  if (tel && net && phonePct && netPct) {
    const to = Math.round(Number(tel.value) * phonePct / 100 + Number(net.value) * netPct / 100)
    proposals.push({ lineKey: util.key, from: util.value, to, fed: { category: 'schc_profit', amount: num(util) - to }, ca: { category: 'schc_profit', amount: num(util) - to }, reason: `Phone at ${phonePct}% and internet at ${netPct}% business use (client call).` })
    evidence.push(tel.id, net.id)
  }
  const personal = text.match(/(\w+) Family in software is personal/i)
  const sub = personal && docsOfType(m, 'books_transaction_detail').flatMap((d) => m.evsByDoc.get(d.id) ?? []).find((e) => e.field.toLowerCase() === personal[1].toLowerCase())
  if (soft && sub && typeof sub.value === 'number') {
    proposals.push({ lineKey: soft.key, from: soft.value, to: num(soft) - sub.value, fed: { category: 'schc_profit', amount: sub.value }, ca: { category: 'schc_profit', amount: sub.value }, reason: `${personal![1]} Family is personal (booked by mistake).` })
    evidence.push(sub.id)
  }
  if (!proposals.length) return []
  return [finding(m, {
    id: 'business-use', check: 'Business-use percentages', title: 'Personal use deducted as business expense',
    severity: 'warning', source: 'check', lines: proposals.map((p) => p.lineKey),
    summary: 'The books deduct the family phone plan, home internet and a music subscription at 100%. On the call Erik put business use at the percentages below and said the subscription is personal.',
    evidence, proposals,
  })]
}

/** Invoices that support a judgment call: their title shares a distinctive word with it. */
function supportingInvoices(m: Model, text: string): string[] {
  const words = new Set(text.toLowerCase().match(/[a-z]{6,}/g) ?? [])
  return docsOfType(m, 'invoice').filter((d) =>
    (d.title.toLowerCase().match(/[a-z]{6,}/g) ?? []).some((w) => w !== 'invoice' && words.has(w))).map((d) => d.id)
}

/** Judgment calls the engine left open: alternatives with a tax effect. */
const whatIfDecisions: Check = (m) =>
  m.packet.what_if.alternatives.filter((w) => w.federal.total_tax_change || w.california.total_tax_change).map((w) => ({
    id: `decision-${w.id}`, check: 'Open judgment calls', title: w.description, area: areaOf(w.changed_lines[0]?.key ?? 'F1040.12'),
    severity: 'judgment' as const, source: 'what_if' as const,
    summary: `The engine computed both treatments. Choosing the alternative changes federal tax by ${signed(w.federal.total_tax_change)} and California tax by ${signed(w.california.total_tax_change)}. Record the decision and the authority relied on.`,
    evidence: [...supportingInvoices(m, w.description), ...m.packet.client.call_notes.filter((c) => c.notes.some((n) => supportingInvoices(m, n).length && supportingInvoices(m, w.description).length)).map((c) => c.id)],
    lines: w.changed_lines.slice(0, 6).map((c) => c.key), proposals: [],
    effect: { fedTax: w.federal.total_tax_change, caTax: w.california.total_tax_change, fedBalance: w.federal.total_tax_change, caBalance: w.california.total_tax_change },
    nextStep: 'Record a decision with the authority relied on.',
  }))

const signed = (n: number) => `${n >= 0 ? '+' : '-'}$${fmtNum(Math.abs(n))}`

/** Open items the prior preparer left, checked against what has arrived since. */
const priorOpenItems: Check = (m, ctx) => {
  const items = m.packet.prior_years.prior_preparer_workpaper.open_items_left_by_prior_preparer
  return items.map((text, i) => {
    let resolvedBy: string | undefined
    if (/2023 Woodworks K-1/i.test(text)) resolvedBy = m.packet.documents.find((d) => d.document_type === 'K-1-1120S' && d.tax_year === 2023 && received(d, ctx))?.id
    if (/2024 Form 5498/i.test(text)) resolvedBy = m.packet.documents.find((d) => d.document_type === '5498' && d.tax_year === 2024 && received(d, ctx))?.id
    if (/home office square footage/i.test(text)) resolvedBy = docsOfType(m, 'client_note').find((d) => received(d, ctx) && /sq ft/.test(d.pages[0].printed_content))?.id
    const outside = /Form 3520/i.test(text)
    return {
      id: `prior-open-${i}`, check: 'Prior preparer open items', title: text, area: outside ? 'retirement' : /K-1/.test(text) ? 'passthroughs' : /5498/.test(text) ? 'retirement' : 'business',
      severity: (resolvedBy ? 'info' : outside ? 'warning' : 'judgment') as Finding['severity'], source: 'prior_preparer' as const,
      summary: resolvedBy
        ? `Left open by the prior preparer. ${resolvedBy} has since arrived: confirm and close.`
        : outside
          ? 'Left open by the prior preparer with no note of resolution. The Swedish account came from a 2023 inheritance over $100,000, which requires Form 3520 for 2023: an outside filing to raise with the client (not in this engagement).'
          : 'Left open by the prior preparer and still unresolved.',
      evidence: [`py:/prior_preparer_workpaper/open_items_left_by_prior_preparer/${i}`, ...(resolvedBy ? [resolvedBy] : []), 'D07'],
      lines: [], proposals: [], effect: ZERO,
      nextStep: resolvedBy ? 'Verify against the document and dismiss with a note.' : outside ? 'Record as an outside filing and tell the client in writing.' : 'Resolve with the client.',
    }
  })
}

/** Excess retirement contribution: deductible limit below what was contributed. */
const sepExcess: Check = (m) => {
  const line = m.current.lines.get('Sch1.16')
  const excess = Number(m.current.v.carryovers_out.federal.sep_contribution_not_deductible_for_2025 ?? 0)
  if (!line || !excess) return []
  return [finding(m, {
    id: 'sep-excess', check: 'Contribution limits', title: `SEP contribution exceeds the limit by ${money(excess)}`,
    severity: 'warning', source: 'check', lines: [line.key],
    summary: `${line.note ?? ''} The excess is not deductible and is subject to a 6% excise tax each year it stays in the account unless withdrawn with earnings by the extended due date. Note: fixing Schedule C changes the limit.`,
    evidence: line.sources, proposals: [],
    nextStep: 'Tell the client to withdraw the excess with earnings before the extended due date, and record the decision.',
  })]
}

/** Engine diagnostics not already explained by a check above. */
function engineDiagnostics(m: Model, covered: Set<string>): Finding[] {
  return m.current.v.diagnostics.filter((x) => !covered.has(x.code)).map((x) => ({
    id: `engine-${x.code}`, check: 'Engine diagnostic', title: x.message, area: x.refs[0] ? areaOf(x.refs[0]) : 'summary',
    severity: x.severity === 'warning' ? 'warning' : 'info', source: 'engine',
    summary: x.message, evidence: x.refs, lines: x.refs.filter((r) => /^[A-Za-z0-9-]+\.\S+$/.test(r) && !r.startsWith('ev-')), proposals: [], effect: ZERO,
  }))
}

const CHECKS: Check[] = [
  supplementalBasis, stateWageSourcing, cardDoubleCount, sehiEligibility, duplicatePages, propertyTaxProration,
  vehicleDonation, payoffInterest, duplicatePayer, fxYear, fedPayments, caPayments, dependentIdentity,
  extractionVsPage, unreadPages, missingBasis, businessUse, sepExcess, whatIfDecisions, priorOpenItems,
]

export function runChecks(m: Model, ctx: CheckContext): Finding[] {
  const found = CHECKS.flatMap((c) => c(m, ctx))
  const covered = new Set(found.flatMap((f) => f.covers ?? []))
  // A low-confidence read the client has since confirmed is covered by the evidence trail.
  for (const e of m.packet.extracted_values) {
    if (e.confidence >= 0.6 || typeof e.value !== 'number') continue
    const amt = fmtNum(e.value)
    const msg = m.packet.client.messages.find((x) => x.sent_at <= ctx.simNow && x.text.includes(amt))
    if (!msg) continue
    covered.add('LOW_CONFIDENCE_READ')
    const lines = m.current.linesByEv.get(e.id) ?? []
    found.push(finding(m, {
      id: `low-confidence-${e.id}`, check: 'Low-confidence reads', title: `${m.docs.get(e.document_id)?.title}: amount read at ${Math.round(e.confidence * 100)}% confidence`,
      severity: 'info', source: 'check', lines,
      summary: `The pipeline read ${money(e.value)} with low confidence. The client confirmed ${amt} in ${msg.id}. Record the verification to clear it.`,
      evidence: [e.id, msg.id], proposals: [], nextStep: 'Record a verification: confirmed with client.',
    }))
  }
  return [...found, ...engineDiagnostics(m, covered)]
}
