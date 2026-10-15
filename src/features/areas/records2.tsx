// Records: state split, payments, carryovers, retirement and foreign, deductions and credits.
import { Table, Th, Tr, Td, TGroup } from '../../components/Table'
import { Tag, Icon } from '../../components/ui'
import { useApp, useModel } from '../../state/app'
import { num, evByField, docsOfType } from '../../lib/packet/model'
import { fmtDate } from '../../lib/format'
import { RefChip, QuoteRef } from '../RefChip'
import { useFindings } from '../findings'
import { Rec, Block, Tie, LV, n0 } from './common'

/* ---------- State split ---------- */

export function StateSplit() {
  const m = useModel()
  const ca = m.current.v.lines.filter((l) => l.form === 'SchCA540NR' && /^\d+\.[A-E]$/.test(l.line))
  const nums = [...new Set(ca.map((l) => l.line.split('.')[0]))]
  const res = m.packet.household.residency
  const caDays = Number(m.packet.engine_reference.parameters.ca_resident_days)
  return (
    <Rec title="State split: California and Texas" intro={`Part-year California resident (${res.map((r) => `${r.state} ${fmtDate(r.from)} to ${fmtDate(r.to)}`).join('; ')}). Texas has no income tax, so the work is Schedule CA (540NR): column D is income under California law, column E is the California-source part.`}>
      <Block title="Schedule CA (540NR)" right={<span className="text-micro text-muted">Residency ratio {caDays} of {String(m.packet.engine_reference.parameters.year_days)} days</span>}>
        <Table dense className="rounded-none border-0">
          <thead><tr><Th>Line</Th><Th num>A Federal</Th><Th num>B Subtract</Th><Th num>C Add</Th><Th num>D CA law</Th><Th num>E CA source</Th><Th>How E was split</Th></tr></thead>
          <tbody>{nums.map((n) => {
            const k = (c: string) => `SchCA540NR.${n}.${c}`
            const e = m.current.lines.get(k('E'))
            return (
              <Tr key={n}>
                <Td><div className="font-medium">{(m.current.lines.get(k('A')) ?? e)?.label.replace(/ - (federal|California amount)$/, '')}</div><div className="font-mono text-micro text-faint">line {n}</div></Td>
                {['A', 'B', 'C', 'D', 'E'].map((c) => <Td key={c} num>{m.current.lines.has(k(c)) ? <LV k={k(c)} /> : <span className="text-faint">-</span>}</Td>)}
                <Td className="max-w-xs text-micro text-muted">{e ? m.packet.engine_reference.rules[e.rule] : ''}</Td>
              </Tr>
            )
          })}
            <TGroup colSpan={7}>Form 540NR</TGroup>
            {['F540NR.17', 'F540NR.32', 'F540NR.34', 'F540NR.35', 'F540NR.37', 'F540NR.64', 'F540NR.78', 'F540NR.97'].map((k) => (
              <Tr key={k}><Td>{m.current.lines.get(k)?.label}</Td><Td num colSpan={5} className="text-right"><LV k={k} /></Td><Td /></Tr>
            ))}
          </tbody>
        </Table>
      </Block>
    </Rec>
  )
}

/* ---------- Payments ---------- */

export function Payments() {
  const m = useModel()
  const simNow = useApp((s) => s.simNow)
  const findings = useFindings()
  const transcripts = m.packet.tax_agency_records.irs_account_transcript_2025.filter((t) => t.as_of <= simNow.slice(0, 10))
  const tr = transcripts[transcripts.length - 1]
  const eftps = docsOfType(m, 'payment_confirmation').find((d) => /EFTPS/i.test(d.title))
  const ftbDoc = docsOfType(m, 'payment_confirmation').find((d) => /FTB/i.test(d.title))
  const qa = m.packet.client.questionnaire.find((q) => /4th quarter/i.test(q.question))
  // Federal estimates: every date seen anywhere, compared side by side.
  const fedDates = new Set<string>()
  const conf = new Map<string, number>()
  if (eftps) for (const e of m.evsByDoc.get(eftps.id) ?? []) if (/_date$/.test(e.field)) { fedDates.add(String(e.value)); conf.set(String(e.value), Number(evByField(m, eftps.id, e.field.replace('_date', '_amount'))?.value ?? 0)) }
  const trans = new Map<string, number>()
  for (const t of tr?.transactions ?? []) if (t.code === '670' && /estimated/i.test(t.description)) { fedDates.add(t.date); trans.set(t.date, Number(t.amount)) }
  const note = m.current.lines.get('F1040.26')?.note ?? ''
  const claimed = new Map([...note.matchAll(/(\d{4}-\d{2}-\d{2}) ([\d,]+)\.00/g)].map((x) => [x[1], Number(x[2].replace(/,/g, ''))]))
  for (const d of claimed.keys()) fedDates.add(d)
  // California: Web Pay confirmations with the tax year each was designated for.
  const ftb = ftbDoc ? (m.evsByDoc.get(ftbDoc.id) ?? []).filter((e) => /_date$/.test(e.field)).map((e) => ({
    date: String(e.value), amount: Number(evByField(m, ftbDoc.id, e.field.replace('_date', '_amount'))?.value), year: String(evByField(m, ftbDoc.id, e.field.replace('_date', '_year'))?.value),
  })) : []
  const ftbAcct = m.packet.tax_agency_records.ftb_account
  const caClaimed: string[] = (m.current.lines.get('F540NR.72')?.note ?? '').match(/\d{4}-\d{2}-\d{2}/g) ?? []
  const open = findings.filter((f) => f.status === 'open' && /estimates-vs-transcript|ca-payments/.test(f.id))
  return (
    <Rec title="Payments" intro="Every payment the return claims, against the client's confirmations and the agencies' own records. Agency records win.">
      {open.map((f) => <div key={f.id} className="flex items-start gap-2 rounded-lg border border-warn/40 bg-warn-soft/50 p-3 text-meta"><Icon name="alert" size={14} className="mt-0.5 text-warn" /><div><b>{f.title}.</b> {f.summary}</div></div>)}
      <div className="grid gap-4 xl:grid-cols-2">
        <Block title="Federal estimated payments" right={tr && <span className="text-micro text-muted">IRS transcript as of {tr.as_of}</span>}>
          <Table dense className="rounded-none border-0">
            <thead><tr><Th>Date</Th><Th num>On the return</Th><Th num>EFTPS</Th><Th num>IRS transcript</Th><Th /></tr></thead>
            <tbody>{[...fedDates].sort().map((d) => {
              const c = claimed.get(d) ?? null; const t = trans.get(d) ?? null; const e = conf.get(d) ?? null
              const ok = c != null && t != null && c === t
              return (
                <Tr key={d}><Td className="tnum whitespace-nowrap">{d}</Td><Td num>{n0(c)}</Td><Td num>{n0(e)}</Td><Td num>{n0(t)}</Td>
                  <Td>{c != null && t == null ? <Tag tone="danger">Not at IRS</Tag> : t != null && c == null ? <Tag tone="warn">Not claimed</Tag> : ok ? <Tag tone="good">Agrees</Tag> : <Tag tone="danger">Differs</Tag>}</Td></Tr>
              )
            })}
              <Tr><Td className="font-semibold">Total</Td><Td num><LV k="F1040.26" /></Td><Td num>{n0([...conf.values()].reduce((a, b) => a + b, 0))}</Td><Td num>{n0([...trans.values()].reduce((a, b) => a + b, 0))}</Td><Td /></Tr>
            </tbody>
          </Table>
          {qa && <div className="border-t border-line2 p-3"><QuoteRef id={qa.id} /></div>}
        </Block>
        <Block title="California estimated payments" right={<span className="text-micro text-muted">FTB account as of {ftbAcct.as_of}</span>}>
          <Table dense className="rounded-none border-0">
            <thead><tr><Th>Date</Th><Th num>Amount</Th><Th>Designated year</Th><Th>On the return</Th></tr></thead>
            <tbody>{ftb.map((p) => (
              <Tr key={p.date} muted={p.year !== String(m.taxYear) && !caClaimed.includes(p.date)}>
                <Td className="tnum whitespace-nowrap">{p.date}</Td><Td num>{n0(p.amount)}</Td>
                <Td>{p.year === String(m.taxYear) ? p.year : <Tag tone="warn">{p.year}</Tag>}</Td>
                <Td>{caClaimed.includes(p.date) ? (p.year === String(m.taxYear) ? <Tag tone="good">Claimed</Tag> : <Tag tone="danger">Claimed, but for {p.year}</Tag>) : <span className="text-micro text-faint">not claimed</span>}</Td>
              </Tr>
            ))}
              <Tr><Td className="font-semibold">Return</Td><Td num><LV k="F540NR.72" /></Td><Td className="text-micro text-muted" colSpan={2}>FTB shows {n0(ftbAcct.tax_year_2025_payments.reduce((s, p) => s + p.amount, 0))} for {m.taxYear} <Tie ok={ftbAcct.tax_year_2025_payments.reduce((s, p) => s + p.amount, 0) === num(m.current.lines.get('F540NR.72'))} /></Td></Tr>
            </tbody>
          </Table>
        </Block>
      </div>
      <Block title="Other payments and credits">
        <Table dense className="rounded-none border-0"><tbody>
          {['F1040.25a', 'Sch3.10', 'Sch3.11', 'F1040.33', 'F540NR.71', 'F540NR.73', 'F540NR.78'].map((k) => (
            <Tr key={k}><Td>{m.current.lines.get(k)?.label}</Td><Td className="font-mono text-micro text-faint">{k}</Td><Td num><LV k={k} /></Td></Tr>
          ))}
        </tbody></Table>
      </Block>
    </Rec>
  )
}

/* ---------- Carryovers ---------- */

const CARRY_USE: Record<string, string[]> = {
  capital_loss_short: ['SchD.6'], capital_loss_long: ['SchD.14'],
  passive_1450_fremont: ['SchE.22A', 'F8582.1c'], passive_1200_barton_hills: ['SchE.22B', 'F8582.1c'],
  section_1231_losses: ['F4797.8'],
}

export function Carryovers() {
  const m = useModel()
  const cin = m.packet.prior_years.carryovers_into_2025 as Record<string, unknown>
  const out = m.current.v.carryovers_out
  return (
    <Rec title="Carryovers" intro="What came in from 2024 (agreed to the 2024 return and the prior preparer's carryover worksheet), where it was used, and what goes out to 2026.">
      <div className="grid gap-4 xl:grid-cols-2">
        <Block title="Into 2025">
          <Table dense className="rounded-none border-0">
            <thead><tr><Th>Carryover</Th><Th num>From 2024</Th><Th>Used on</Th></tr></thead>
            <tbody>{Object.entries(cin).filter(([, v]) => typeof v === 'number').map(([k, v]) => (
              <Tr key={k}><Td className="capitalize">{k.replace(/_/g, ' ')}</Td><Td num>{n0(v as number)}</Td>
                <Td className="text-micro">{(CARRY_USE[k] ?? []).map((l) => <span key={l} className="mr-2"><span className="font-mono text-accent">{l}</span> <LV k={l} /></span>)}{!(CARRY_USE[k] ?? []).length && <span className="text-faint">{v ? 'see return' : 'none'}</span>}</Td></Tr>
            ))}</tbody>
          </Table>
          <div className="border-t border-line2 p-3"><RefChip id="py:/carryovers_into_2025" /></div>
        </Block>
        <Block title="Out to 2026">
          <Table dense className="rounded-none border-0">
            <tbody>
              <TGroup colSpan={2}>Federal</TGroup>
              {Object.entries(out.federal).map(([k, v]) => <Tr key={k}><Td className="capitalize">{k.replace(/_/g, ' ')}</Td><Td num>{v == null ? <span className="text-faint">not computed</span> : n0(v)}</Td></Tr>)}
              <TGroup colSpan={2}>California</TGroup>
              {Object.entries(out.california).map(([k, v]) => <Tr key={k}><Td className="capitalize">{k.replace(/_/g, ' ')}</Td><Td num>{typeof v === 'number' ? n0(v) : Object.entries(v as Record<string, number>).map(([a, b]) => `${a} ${n0(b)}`).join(' · ')}</Td></Tr>)}
            </tbody>
          </Table>
          <p className="border-t border-line2 px-4 py-2 text-micro text-muted">Engine values at {m.current.v.version}. Adjustments that change capital gains or the SEP limit change these too; the next engine run recomputes them.</p>
        </Block>
      </div>
    </Rec>
  )
}

/* ---------- Retirement and foreign ---------- */

export function RetirementForeign() {
  const m = useModel()
  return (
    <Rec title="Retirement and foreign" intro="The backdoor Roth (Form 8606 with last year's basis), the SEP and HSA, and the Swedish account: interest, Form 8938, and the filings that sit outside this return.">
      <div className="grid gap-4 xl:grid-cols-2">
        <Block title="IRA basis and Roth conversion (Form 8606)">
          <Table dense className="rounded-none border-0"><tbody>
            {['F8606.1', 'F8606.2', 'F8606.3', 'F8606.6', 'F8606.8', 'F8606.17', 'F8606.18', 'F8606.14'].map((k) => <Tr key={k}><Td>{m.current.lines.get(k)?.label}</Td><Td num><LV k={k} /></Td></Tr>)}
          </tbody></Table>
          <p className="border-t border-line2 px-4 py-2 text-micro text-muted">The client said there was no prior basis (qa-31); the 2024 Form 8606 and the 2024 Form 5498 show 7,000. Documents win: only 26 is taxable.</p>
        </Block>
        <Block title="SEP and HSA">
          <Table dense className="rounded-none border-0"><tbody>
            {['Sch1.16', 'F8889.3', 'F8889.9', 'F8889.13', 'F8889.14a', 'F8889.16'].map((k) => <Tr key={k}><Td>{m.current.lines.get(k)?.label}</Td><Td num><LV k={k} /></Td></Tr>)}
          </tbody></Table>
          <p className="border-t border-line2 px-4 py-2 text-micro text-muted">{m.current.lines.get('Sch1.16')?.note}</p>
        </Block>
        <Block title="Foreign account (Sparbanken Norrland)">
          <Table dense className="rounded-none border-0"><tbody>
            {['SchB.1.6', 'SchB.7a', 'SchB.7b', 'F8938.1.max', 'F8938.1.ye', 'F8938.req', 'Sch3.1'].map((k) => <Tr key={k}><Td>{m.current.lines.get(k)?.label}</Td><Td num><LV k={k} /></Td></Tr>)}
          </tbody></Table>
        </Block>
        <Block title="Filings outside this return">
          <ul className="space-y-2 p-3 text-meta">
            <li><b>FinCEN 114 (FBAR) for 2025</b>: maximum value about $149,567, due {fmtDate('2026-10-15')}. Not in the engagement (D01); tell the client in writing.</li>
            <li><b>Form 3520 for 2023</b>: inheritance from a foreign person over $100,000 (account opened 09/2023). The prior preparer left it unresolved. Possible late filing.</li>
            <li><b>Form 5329</b> if the excess SEP contribution is not withdrawn by the extended due date.</li>
          </ul>
        </Block>
      </div>
    </Rec>
  )
}

/* ---------- Deductions and credits with limits ---------- */

export function Deductions() {
  const m = useModel()
  const p = m.packet.engine_reference.parameters
  const agi = num(m.current.lines.get('F1040.11'))
  const cap = Math.max(Number(p.salt_cap_floor), Number(p.salt_cap) - Math.max(0, agi - Number(p.salt_cap_phase_start)) * Number(p.salt_cap_phase_rate))
  const magi = agi
  const ctcReduction = Math.ceil(Math.max(0, magi - Number(p.ctc_phaseout_start)) / 1000) * 50
  const groups: [string, string[], React.ReactNode?][] = [
    ['State and local taxes', ['SchA.5a', 'SchA.5b', 'SchA.5d', 'SchA.5e'], <>Cap for this AGI recomputed: {n0(cap)} <Tie ok={cap === num(m.current.lines.get('SchA.5e')) || num(m.current.lines.get('SchA.5d')) < cap} /></>],
    ['Mortgage interest', ['SchA.8a', 'SchA.8c', 'SchA.8e']],
    ['Charity', ['SchA.11', 'F8283.A1.stock', 'F8283.A1.vehicle', 'SchA.12', 'SchA.14']],
    ['Deduction choice', ['SchA.17', 'F1040.12'], <>Standard deduction {n0(Number(p.std_deduction_mfj))}: itemizing saves tax</>],
    ['Child tax credit and other dependents', ['F8812.1', 'F8812.8', 'F8812.11', 'F8812.12'], <>Phase-out recomputed: 50 per 1,000 over {n0(Number(p.ctc_phaseout_start))} = {n0(ctcReduction)} <Tie ok={ctcReduction === num(m.current.lines.get('F8812.11'))} /></>],
    ['Education (AOTC)', ['F8863.27', 'F8863.30', 'F8863.7']],
    ['Dependent care', ['F2441.1a', 'F2441.1b', 'F2441.2', 'F2441.12', 'F2441.31']],
    ['Foreign tax credit and due diligence', ['Sch3.1', 'F8867.status']],
  ]
  return (
    <Rec title="Deductions and credits, with limits" intro="Each deduction and credit with the limit that applies, recomputed here where the rule is simple enough to check without the engine.">
      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map(([title, keys, check]) => (
          <Block key={title} title={title}>
            <Table dense className="rounded-none border-0"><tbody>
              {keys.map((k) => <Tr key={k}><Td>{m.current.lines.get(k)?.label ?? k}</Td><Td num><LV k={k} /></Td></Tr>)}
            </tbody></Table>
            {check && <div className="flex items-center gap-2 border-t border-line2 px-4 py-2 text-micro text-muted">{check}</div>}
          </Block>
        ))}
      </div>
    </Rec>
  )
}
