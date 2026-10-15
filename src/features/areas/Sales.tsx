// Hundreds of sales without swamping the review: broker totals tied to each
// broker's own summary, exceptions first, then every lot in a virtual list.
import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Table, Th, Tr, Td } from '../../components/Table'
import { Icon, Tag, cx } from '../../components/ui'
import { useModel } from '../../state/app'
import { evByField } from '../../lib/packet/model'
import { useTrace } from '../trace/useTrace'
import { useFindings } from '../findings'
import { allLots, type Lot } from './lots'
import { Rec, Block, Tie, LV, n0, n2 } from './common'

export default function Sales() {
  const m = useModel()
  const lots = useMemo(() => allLots(m), [m])
  const findings = useFindings()
  const flagged = new Set(findings.filter((f) => f.status === 'open').flatMap((f) => f.lines))

  // Totals by broker document and term.
  const groups = new Map<string, { broker: string; docId: string | null; term: string; n: number; proceeds: number; basis: number; wash: number; gain: number }>()
  for (const l of lots) {
    const k = `${l.docId}|${l.term}`
    const g = groups.get(k) ?? { broker: l.broker, docId: l.docId, term: l.term, n: 0, proceeds: 0, basis: 0, wash: 0, gain: 0 }
    g.n++; g.proceeds += l.proceeds ?? 0; g.basis += l.basis ?? 0; g.wash += l.wash; g.gain += l.gain
    groups.set(k, g)
  }
  // What each broker itself reported, where the packet has a summary.
  const reported = (docId: string | null, term: string): number | null => {
    if (!docId) return null
    const f = evByField(m, docId, `${term === 'short' ? 'st' : 'lt'}_proceeds`)
    if (f && typeof f.value === 'number') return f.value
    const all = evByField(m, docId, 'b_summary_proceeds') ?? evByField(m, docId, 'total')
    return all && typeof all.value === 'number' && term === 'short' ? all.value : null
  }
  const totalByDoc = (docId: string | null) => [...groups.values()].filter((g) => g.docId === docId).reduce((s, g) => s + g.proceeds, 0)

  const exceptions = lots.filter((l) => l.basisMissing || l.wash > 0 || l.adjusted || flagged.has(l.key))

  return (
    <Rec title="Sales detail" intro={`${lots.length} sales on Form 8949 from ${new Set(lots.map((l) => l.docId)).size} sources. Totals are tied to each broker's own summary; exceptions come first so the review is the 30 that matter, not the ${lots.length}.`}>
      <Block title="By broker and term">
        <Table dense className="rounded-none border-0">
          <thead><tr><Th>Source</Th><Th>Term</Th><Th num>Sales</Th><Th num>Proceeds</Th><Th num>Basis</Th><Th num>Wash</Th><Th num>Gain</Th><Th>Broker summary</Th></tr></thead>
          <tbody>{[...groups.values()].map((g) => {
            const rep = reported(g.docId, g.term)
            const whole = rep != null && !evByField(m, g.docId ?? '', `${g.term === 'short' ? 'st' : 'lt'}_proceeds`)
            const mine = whole ? totalByDoc(g.docId) : g.proceeds
            return (
              <Tr key={`${g.docId}${g.term}`}>
                <Td><span className="font-medium">{g.broker}</span>{g.docId && <span className="ml-1.5 font-mono text-micro text-faint">{g.docId}</span>}</Td>
                <Td className="capitalize">{g.term}</Td>
                <Td num>{g.n}</Td><Td num>{n2(g.proceeds)}</Td><Td num>{n2(g.basis)}</Td><Td num>{g.wash ? n2(g.wash) : '-'}</Td>
                <Td num className={g.gain < 0 ? 'text-danger' : ''}>{n0(g.gain)}</Td>
                <Td>{rep == null ? <span className="text-micro text-faint">no summary</span>
                  : <span className="flex items-center gap-1.5"><Tie ok={Math.abs(rep - mine) < 1} label={Math.abs(rep - mine) < 1 ? 'Ties' : `Off by ${n2(rep - mine)}`} />
                    <span className="tnum text-micro text-muted">{n2(rep)}{whole ? ' all terms' : ''}</span></span>}</Td>
              </Tr>
            )
          })}</tbody>
        </Table>
      </Block>

      <Block title={`Exceptions (${exceptions.length})`} right={<span className="text-micro text-muted">missing basis · wash sales · adjustments · open findings</span>}>
        <LotTable lots={exceptions} flagged={flagged} height={Math.min(420, 40 + exceptions.length * 38)} />
      </Block>

      <AllLots lots={lots} flagged={flagged} />
    </Rec>
  )
}

function AllLots({ lots, flagged }: { lots: Lot[]; flagged: Set<string> }) {
  const [q, setQ] = useState('')
  const [box, setBox] = useState('all')
  const s = q.trim().toLowerCase()
  const shown = lots.filter((l) => (box === 'all' || l.box === box) && (!s || `${l.description} ${l.key} ${l.broker}`.toLowerCase().includes(s)))
  return (
    <Block title={`All sales (${shown.length})`} right={
      <div className="flex items-center gap-2">
        <select value={box} onChange={(e) => setBox(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1 text-meta">
          <option value="all">All boxes</option>{[...new Set(lots.map((l) => l.box))].sort().map((b) => <option key={b} value={b}>Box {b}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search security or lot" className="w-48 rounded-lg border border-line bg-surface px-2 py-1 text-meta" />
      </div>}>
      <LotTable lots={shown} flagged={flagged} height={480} />
    </Block>
  )
}

const COLS = 'grid grid-cols-[70px_minmax(0,1fr)_88px_88px_96px_96px_70px_88px] gap-2'

/** Virtualized: only the rows on screen are rendered, so 300 or 30,000 lots scroll the same. */
function LotTable({ lots, flagged, height }: { lots: Lot[]; flagged: Set<string>; height: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const { open, key } = useTrace()
  const v = useVirtualizer({ count: lots.length, getScrollElement: () => ref.current, estimateSize: () => 38, overscan: 12 })
  if (!lots.length) return <div className="px-4 py-6 text-center text-body text-muted">None.</div>
  return (
    <div>
      <div className={cx(COLS, 'border-b border-line2 bg-bgtint px-3 py-2 text-micro font-bold uppercase tracking-wider text-faint')}>
        <span>Lot</span><span>Security</span><span>Acquired</span><span>Sold</span><span className="text-right">Proceeds</span><span className="text-right">Basis</span><span className="text-right">Wash</span><span className="text-right">Gain</span>
      </div>
      <div ref={ref} className="pane overflow-auto" style={{ height }}>
        <div style={{ height: v.getTotalSize(), position: 'relative' }}>
          {v.getVirtualItems().map((r) => {
            const l = lots[r.index]
            return (
              <div key={l.key} onClick={() => open(l.key)} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: r.size, transform: `translateY(${r.start}px)` }}
                className={cx(COLS, 'cursor-pointer items-center border-b border-line2 px-3 text-meta transition hover:bg-slateSoft', key === l.key && 'bg-accent-soft/60')}>
                <span className="font-mono text-micro text-muted">{l.box}.{l.id}</span>
                <span className="flex min-w-0 items-center gap-1.5"><span className="truncate">{l.description}</span>
                  {l.basisMissing && <Tag tone="danger">no basis</Tag>}{l.wash > 0 && <Tag tone="warn">wash</Tag>}{l.adjusted && <Tag tone="accent">adj</Tag>}
                  {flagged.has(l.key) && <Icon name="alert" size={12} className="shrink-0 text-warn" />}</span>
                <span className="tnum text-micro text-muted">{l.acquired ?? 'unknown'}</span>
                <span className="tnum text-micro text-muted">{l.sold ?? '-'}</span>
                <span className="tnum text-right">{n2(l.proceeds)}</span>
                <span className="tnum text-right">{l.basis == null ? <span className="text-danger">-</span> : n2(l.basis)}</span>
                <span className="tnum text-right text-muted">{l.wash ? n2(l.wash) : ''}</span>
                <span className="text-right"><LV k={l.key} /></span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
