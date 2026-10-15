// Records: depreciation by asset, books to tax, rentals and passive losses, K-1s and basis.
import { useMemo } from 'react'
import { Table, Th, Tr, Td, TGroup } from '../../components/Table'
import { Tag } from '../../components/ui'
import { useApp, useModel } from '../../state/app'
import { num, evByField, docsOfType } from '../../lib/packet/model'
import type { ExtractedValue } from '../../lib/packet/types'
import { fmtDate } from '../../lib/format'
import { RefChip } from '../RefChip'
import { Rec, Block, Tie, LV, n0, n2 } from './common'

/* ---------- Depreciation by asset ---------- */

export function Depreciation() {
  const m = useModel()
  const assets = m.current.v.assets
  const byActivity = new Map<string, typeof assets>()
  for (const a of assets) byActivity.set(a.activity, [...(byActivity.get(a.activity) ?? []), a])
  // Tie each activity's federal total to the Form 4562 line the return uses.
  const tieLine = (activity: string) => m.current.v.lines.find((l) => (l.form === 'F4562-C' && l.line === '22' && /Business/.test(activity)) || (l.form === 'F4562-E' && l.sources.some((s) => assets.some((a) => a.activity === activity && s === `asset:${a.asset_id}`))))
  return (
    <Rec title="Depreciation by asset" intro="Every asset with method, life and special depreciation, federal against California and AMT, and disposals with recapture. Activity totals are tied to the Form 4562 lines on the return.">
      <Block title="Assets">
        <Table dense className="rounded-none border-0">
          <thead><tr><Th>Asset</Th><Th>In service</Th><Th>Method · life</Th><Th num>Cost</Th><Th num>Federal 2025</Th><Th num>California 2025</Th><Th num>AMT 2025</Th><Th num>Accum. federal</Th><Th>Disposal</Th></tr></thead>
          <tbody>
            {[...byActivity.entries()].map(([act, list]) => {
              const fed = list.reduce((s, a) => s + a.federal.depreciation_2025, 0)
              const line = tieLine(act)
              return [
                <TGroup key={act} colSpan={9} right={line ? <span className="flex items-center gap-2">{line.key} <LV k={line.key} /> <Tie ok={Math.abs(num(line) - fed) < 1.5} /></span> : undefined}>{act}</TGroup>,
                ...list.map((a) => (
                  <Tr key={a.asset_id}>
                    <Td><div className="font-medium">{a.description}</div><div className="font-mono text-micro text-faint">{a.asset_id}</div></Td>
                    <Td className="tnum text-micro">{a.placed_in_service}</Td>
                    <Td className="text-micro">{a.method} · {a.life_years}y</Td>
                    <Td num>{n0(a.cost)}{a.land_value_not_depreciated ? <div className="text-micro text-faint">+ land {n0(a.land_value_not_depreciated)}</div> : null}</Td>
                    <Td num>{n2(a.federal.depreciation_2025)}</Td>
                    <Td num className={a.california.depreciation_2025 !== a.federal.depreciation_2025 ? 'font-semibold text-accent' : ''}>{n2(a.california.depreciation_2025)}</Td>
                    <Td num>{n2(a.amt.depreciation_2025)}</Td>
                    <Td num>{n2(a.federal.accumulated_end)}</Td>
                    <Td className="text-micro">{a.disposition ? <span>Sold {a.disposition.date}<br />Unrecaptured 1250: {n2(a.disposition.unrecaptured_1250_depreciation)}<br />1250 ordinary: {n2(a.disposition.section_1250_ordinary_recapture)}</span> : <span className="text-faint">Held</span>}</Td>
                  </Tr>
                )),
              ]
            })}
          </tbody>
        </Table>
      </Block>
      <p className="text-micro text-muted">California does not allow federal special depreciation, so the studio equipment and the 2021 appliances carry California basis differences forward (shown in accent).</p>
    </Rec>
  )
}

/* ---------- Books to tax ---------- */

export function BooksToTax() {
  const m = useModel()
  const books = docsOfType(m, 'books_profit_loss')[0]
  const rows = useMemo(() => {
    if (!books) return []
    const items = (m.evsByDoc.get(books.id) ?? []).filter((e) => e.page === 1 && typeof e.value === 'number' && !/^(total_|net_)/.test(e.field))
    const schc = m.current.v.lines.filter((l) => l.form === 'SchC' && typeof l.value === 'number' && /^(1|[89]|[12]\d|30)(\.\d+)?$|^27a\.\d$|^24[ab]$/.test(l.line) && !/^(28|29)$/.test(l.line))
    const used = new Set<string>()
    const out: { key: string | null; label: string; books: ExtractedValue[]; tax: number; income: boolean; why: string }[] = []
    for (const l of schc) {
      const total = evByField(m, books.id, 'total_income')!
      const bi = l.line === '1' ? [total] : items.filter((e) => l.sources.includes(e.id) || (l.note ?? '').toLowerCase().includes(e.field.toLowerCase()))
      bi.forEach((e) => used.add(e.id))
      out.push({ key: l.key, label: l.label, books: bi, tax: num(l), income: l.line === '1', why: l.note ?? m.packet.engine_reference.rules[l.rule] ?? l.rule })
    }
    for (const e of items.filter((x) => !used.has(x.id) && !/^Sales/.test(x.field))) {
      const word = e.field.match(/health/i) ? 'health insurance' : e.field.toLowerCase()
      const elsewhere = m.current.v.lines.find((l) => l.form !== 'SchC' && l.label.toLowerCase().includes(word))
      out.push({ key: null, label: e.label, books: [e], tax: 0, income: false, why: elsewhere ? `Not a Schedule C expense: deducted on ${elsewhere.key} (${elsewhere.label}) instead.` : 'Not deducted.' })
    }
    return out
  }, [m, books])
  if (!books) return <Rec title="Books to tax">No books in the file.</Rec>
  const bookNet = evByField(m, books.id, 'net_income')!
  const impact = (r: (typeof rows)[number]) => { const b = r.books.reduce((s, e) => s + (e.value as number), 0); return r.income ? r.tax - b : b - r.tax }
  const bridge = (bookNet.value as number) + rows.reduce((s, r) => s + impact(r), 0)
  const net = m.current.lines.get('SchC.31')!
  return (
    <Rec title="Books to taxable income" intro="The client's QuickBooks profit and loss, line by line to Schedule C, with the reason for every difference. The bridge must land exactly on net profit.">
      <Block title="Lindqvist Studio: books to Schedule C" right={<Tie ok={Math.abs(bridge - num(net)) < 2} label={Math.abs(bridge - num(net)) < 2 ? 'Bridge ties to net profit' : 'Bridge does not tie'} />}>
        <Table dense className="rounded-none border-0">
          <thead><tr><Th>Item</Th><Th num>Books</Th><Th num>Tax</Th><Th num>Effect on profit</Th><Th>Why</Th></tr></thead>
          <tbody>
            <Tr><Td className="font-semibold">Books net income</Td><Td num className="font-semibold">{n0(bookNet.value as number)}</Td><Td /><Td /><Td><RefChip id={bookNet.id} compact /></Td></Tr>
            {rows.map((r) => {
              const b = r.books.reduce((s, e) => s + (e.value as number), 0)
              const i = impact(r)
              return (
                <Tr key={(r.key ?? '') + r.label}>
                  <Td><div>{r.label}</div>{r.key && <div className="font-mono text-micro text-faint">{r.key}</div>}</Td>
                  <Td num>{r.books.length ? n0(b) : '-'}</Td>
                  <Td num>{r.key ? <LV k={r.key} /> : <span className="text-faint">0</span>}</Td>
                  <Td num className={i ? (i < 0 ? 'text-danger' : 'text-good') : 'text-faint'}>{i ? `${i > 0 ? '+' : ''}${n0(i)}` : '-'}</Td>
                  <Td className="max-w-md text-micro text-muted">{Math.round(i) ? r.why : 'Same as books.'}</Td>
                </Tr>
              )
            })}
            <Tr><Td className="font-semibold">Schedule C net profit</Td><Td num className="font-semibold">{n0(bridge)}</Td><Td num className="font-semibold"><LV k="SchC.31" /></Td><Td /><Td /></Tr>
          </tbody>
        </Table>
      </Block>
    </Rec>
  )
}

/* ---------- Rentals and passive losses ---------- */

const RENT_ROWS: [string, string][] = [['3', 'Rents received'], ['9', 'Insurance'], ['11', 'Management fees'], ['12', 'Mortgage interest'], ['14', 'Repairs'], ['16', 'Taxes'], ['18', 'Depreciation'], ['19', 'Other (HOA)'], ['20', 'Total expenses'], ['21', 'Income or (loss)'], ['22', 'Allowed after passive limits']]

export function Rentals() {
  const m = useModel()
  const py = m.packet.prior_years.carryovers_into_2025 as Record<string, number>
  return (
    <Rec title="Rentals and passive losses" intro="Both properties side by side, the passive activity limitation with last year's suspended losses, and the condo sale.">
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Block title="Schedule E">
          <Table dense className="rounded-none border-0">
            <thead><tr><Th>Line</Th><Th num>1450 Fremont Way</Th><Th num>1200 Barton Hills 4C</Th></tr></thead>
            <tbody>
              <Tr><Td className="text-muted">Days rented / personal</Td><Td num><LV k="SchE.2A" /></Td><Td num><LV k="SchE.2B" /></Td></Tr>
              {RENT_ROWS.map(([n, label]) => (
                <Tr key={n}><Td>{label}</Td><Td num><LV k={`SchE.${n}A`} /></Td><Td num><LV k={`SchE.${n}B`} /></Td></Tr>
              ))}
              <Tr><Td className="text-muted">Suspended loss from 2024</Td><Td num>{n0(py.passive_1450_fremont)}</Td><Td num>{n0(py.passive_1200_barton_hills)}</Td></Tr>
            </tbody>
          </Table>
        </Block>
        <div className="space-y-4">
          <Block title="Passive limitation (Form 8582)">
            <Table dense className="rounded-none border-0"><tbody>
              {['F8582.1a', 'F8582.1b', 'F8582.1c', 'F8582.3a', 'F8582.4'].map((k) => (
                <Tr key={k}><Td>{m.current.lines.get(k)?.label}</Td><Td num><LV k={k} /></Td></Tr>
              ))}
            </tbody></Table>
            <p className="border-t border-line2 px-4 py-2 text-micro text-muted">{m.current.lines.get('F8582.4')?.note}</p>
          </Block>
          <Block title="Condo sale (Form 4797)">
            <Table dense className="rounded-none border-0"><tbody>
              {['F4797.20', 'F4797.21', 'F4797.22', 'F4797.23', 'F4797.24', 'F4797.25', 'SchD.19'].map((k) => (
                <Tr key={k}><Td>{m.current.lines.get(k)?.label}</Td><Td num><LV k={k} /></Td></Tr>
              ))}
            </tbody></Table>
          </Block>
        </div>
      </div>
    </Rec>
  )
}

/* ---------- K-1s and basis by year ---------- */

export function PassThroughs() {
  const m = useModel()
  const simNow = useApp((s) => s.simNow)
  const k1s = m.packet.documents.filter((d) => /^K-1/.test(d.document_type) && d.tax_year === m.taxYear)
  // S corporation stock basis, rolled forward independently from the K-1s on file.
  const rec = m.packet.prior_years.basis_records.scorp_lindqvist_family_woodworks as { year: number; ending_stock_basis?: number | null; k1_income?: number; distributions?: number; source: string }[]
  const k23 = m.packet.documents.find((d) => d.document_type === 'K-1-1120S' && d.tax_year === 2023 && d.received_at <= simNow)
  const k25 = m.packet.documents.find((d) => d.document_type === 'K-1-1120S' && d.tax_year === m.taxYear)
  const v = (doc: typeof k23, f: string) => (doc ? Number(evByField(m, doc.id, f)?.value ?? 0) : 0)
  const rows: { year: number; begin: number | null; income: number | null; dist: number | null; end: number | null; source: string; gap?: boolean }[] = []
  let basis: number | null = rec.find((r) => r.year === 2022)?.ending_stock_basis ?? null
  rows.push({ year: 2022, begin: null, income: null, dist: null, end: basis, source: rec[0].source })
  if (k23) { const inc = v(k23, 'box1') + v(k23, 'box4'); const dist = v(k23, 'box16d'); rows.push({ year: 2023, begin: basis, income: inc, dist, end: basis! + inc - Math.min(dist, basis! + inc), source: `${k23.id} (2023 K-1, received ${k23.received_at.slice(0, 10)})` }); basis = rows[rows.length - 1].end }
  else rows.push({ year: 2023, begin: basis, income: null, dist: null, end: basis, source: 'Missing: 2023 K-1 not on file. Unknown year assumed no change.', gap: true })
  const r24 = rec.find((r) => r.year === 2024)!
  { const inc = r24.k1_income ?? 0; const dist = r24.distributions ?? 0; rows.push({ year: 2024, begin: basis, income: inc, dist, end: Math.max(0, basis! + inc - dist), source: r24.source }); basis = rows[rows.length - 1].end }
  const inc25 = v(k25, 'box1') + v(k25, 'box4'); const dist25 = v(k25, 'box16d')
  const excess = Math.max(0, dist25 - (basis! + inc25))
  rows.push({ year: 2025, begin: basis, income: inc25, dist: dist25, end: Math.max(0, basis! + inc25 - dist25), source: k25 ? `${k25.id}` : 'K-1 not received' })
  return (
    <Rec title="K-1s and basis by year" intro="Every K-1 line and where it landed, with stock basis rolled forward year by year from the K-1s on file (not from the engine), so gaps are visible.">
      <Block title="K-1 lines">
        <Table dense className="rounded-none border-0">
          <thead><tr><Th>Entity</Th><Th>Item</Th><Th num>Amount</Th><Th>On the return</Th></tr></thead>
          <tbody>{k1s.flatMap((d) => (m.evsByDoc.get(d.id) ?? []).map((e) => (
            <Tr key={e.id}>
              <Td className="text-micro">{d.issuer || d.title.replace(/^.*- /, '')}<div className="font-mono text-faint">{d.id}</div></Td>
              <Td>{e.label}</Td><Td num>{typeof e.value === 'number' ? (e.value < 1 ? `${Math.round(e.value * 100)}%` : n0(e.value)) : String(e.value)}</Td>
              <Td className="text-micro">{(m.current.linesByEv.get(e.id) ?? []).map((k) => <span key={k} className="mr-1.5 inline-block"><span className="font-mono text-accent">{k}</span> <LV k={k} /></span>)}{!(m.current.linesByEv.get(e.id) ?? []).length && <span className="text-faint">basis or information only</span>}</Td>
            </Tr>
          )))}</tbody>
        </Table>
      </Block>
      <Block title="Lindqvist Family Woodworks: stock basis" right={<span className="flex items-center gap-2 text-micro">Return beginning basis <LV k="F7203.1" /> <Tie ok={rows[3].begin === num(m.current.lines.get('F7203.1'))} /> · excess distribution <LV k="F7203.excess" /> <Tie ok={Math.abs(excess - num(m.current.lines.get('F7203.excess'))) < 1.5} /></span>}>
        <Table dense className="rounded-none border-0">
          <thead><tr><Th>Year</Th><Th num>Beginning</Th><Th num>Income</Th><Th num>Distributions</Th><Th num>Ending</Th><Th>Source</Th></tr></thead>
          <tbody>{rows.map((r) => (
            <Tr key={r.year} muted={r.gap}>
              <Td className="font-semibold">{r.year}</Td><Td num>{n0(r.begin)}</Td><Td num>{n0(r.income)}</Td><Td num>{n0(r.dist)}</Td><Td num className="font-semibold">{n0(r.end)}</Td>
              <Td className="text-micro">{r.gap ? <Tag tone="warn">Gap</Tag> : null} {r.source}</Td>
            </Tr>
          ))}</tbody>
        </Table>
        <p className="border-t border-line2 px-4 py-2 text-micro text-muted">2025 distributions exceed basis by {n0(excess)}: taxed as capital gain (Form 8949 box F). The prior preparer assumed basis was sufficient without the 2023 K-1; with it, 2024 ended at {n0(rows[2].end)}.</p>
      </Block>
      <Block title="Ridgeline Real Estate Fund III: capital account">
        <div className="space-y-1 px-4 py-3 text-meta">
          {['cap_begin', 'box2', 'box5', 'box9a', 'box19a', 'box21', 'cap_end'].map((f) => { const d37 = k1s.find((d) => d.document_type === 'K-1-1065'); const e = d37 && evByField(m, d37.id, f); return e ? <div key={f} className="flex justify-between"><span>{e.label}</span><span className="tnum">{n0(e.value as number)}</span></div> : null })}
          <p className="pt-1 text-micro text-muted">Outside basis was never computed by the prior preparer (basis records). Capital account rolls from 60,000 to 63,660 per the K-1; received {fmtDate(k1s.find((d) => d.document_type === 'K-1-1065')?.received_at ?? '2026-06-22')}.</p>
        </div>
      </Block>
    </Rec>
  )
}
