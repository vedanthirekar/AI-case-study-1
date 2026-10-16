// The return map: the return's spine as a graph. Each node shows its value, the
// open issues that land on it and the dollars at risk. Click to zoom into lineage.
import { memo, useMemo } from 'react'
import dagre from '@dagrejs/dagre'
import { ReactFlow, Background, Controls, Handle, Position, MarkerType, type Node, type Edge, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Icon, cx } from '../../components/ui'
import { fmtValue, fmtMoney } from '../../lib/format'
import { SPINE, type SpineNode, type SpineStat } from './spine'
import FitOnResize from '../graph/FitOnResize'

type Data = { node: SpineNode; stat: SpineStat; dim: boolean; lit: boolean }

// Every card has this exact size, so the layout never overlaps them.
const W = 196, H = 84

const TONE = {
  error: 'border-danger bg-danger-soft/40',
  warning: 'border-warn bg-warn-soft/50',
  judgment: 'border-ai bg-ai-soft/50',
  info: 'border-line bg-surface',
}

const Card = memo(({ data }: NodeProps<Node<Data>>) => {
  const { node, stat, dim, lit } = data
  const tone = stat.worst ? TONE[stat.worst] : stat.adjusted ? 'border-accent bg-accent-soft/40' : 'border-line bg-surface'
  const bottom = node.id === 'owed' || node.id === 'ca_owed'
  const value = typeof stat.value === 'number' ? stat.value : null
  // The California line holds the overpayment as a positive refund; the estimate is a balance (negative = refund).
  const estShown = stat.estimate == null ? null : node.id === 'ca_owed' ? -stat.estimate : stat.estimate
  const shownLabel = node.id === 'owed' && stat.estimate != null && stat.estimate < 0 ? 'Refund (estimate)' : node.label
  return (
    <div className={cx('flex flex-col overflow-hidden rounded-md border-2 px-3 py-1.5 shadow-sm transition', tone, dim && 'opacity-40', lit && 'ring-4 ring-accent/40', bottom && 'border-[3px]')} style={{ width: W, height: H }}
      title={stat.open.length ? `${stat.open.length} open issue${stat.open.length > 1 ? 's' : ''}${stat.atRisk >= 1 ? `, about ${fmtMoney(Math.round(stat.atRisk))} owed differently if fixed (estimate)` : ''}` : undefined}>
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-faint" />
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-faint" />
      <div className="flex items-center gap-1.5">
        <span className="truncate text-meta font-semibold text-ink">{shownLabel}</span>
        {node.jurisdiction === 'california' && <span className="ml-auto rounded-sm bg-bgtint px-1 text-[10px] font-bold text-muted">CA</span>}
      </div>
      <div className="tnum text-title font-semibold">{value != null ? fmtMoney(value) : fmtValue(stat.value)}</div>
      {stat.estimate != null && Math.round(estShown!) !== Math.round(value ?? NaN) && (
        <div className="tnum truncate text-micro text-accent">est. with fixes {fmtMoney(Math.abs(stat.estimate))}{bottom ? (stat.estimate < 0 ? ' refund' : ' owed') : ''}</div>
      )}
      <div className="mt-auto flex items-center gap-2 whitespace-nowrap text-micro">
        {stat.open.length > 0 ? (
          <span className={cx('flex items-center gap-1 font-semibold', stat.worst === 'error' ? 'text-danger' : stat.worst === 'judgment' ? 'text-ai' : 'text-warn')}>
            <Icon name="alert" size={11} />{stat.open.length} issue{stat.open.length > 1 ? 's' : ''}{stat.atRisk >= 1 && ` · ${fmtMoney(Math.round(stat.atRisk))}`}
          </span>
        ) : stat.adjusted ? <span className="flex items-center gap-1 text-accent"><Icon name="edit" size={11} />adjusted</span>
          : <span className="flex items-center gap-1 text-good"><Icon name="check" size={11} />no open issues</span>}
        <span className="ml-auto font-mono text-[10px] text-faint">{node.key}</span>
      </div>
    </div>
  )
})

const nodeTypes = { spine: Card }

export default function ReturnMap({ stats, highlight, onPick }: { stats: Map<string, SpineStat>; highlight: Set<string> | null; onPick: (n: SpineNode) => void }) {
  const { nodes, edges } = useMemo(() => {
    const g = new dagre.graphlib.Graph()
    g.setGraph({ rankdir: 'LR', nodesep: 14, ranksep: 64, marginx: 6, marginy: 6 })
    g.setDefaultEdgeLabel(() => ({}))
    for (const n of SPINE) g.setNode(n.id, { width: W, height: H })
    for (const n of SPINE) for (const t of n.to) g.setEdge(n.id, t)
    dagre.layout(g)
    const nodes: Node<Data>[] = SPINE.map((n) => {
      const p = g.node(n.id)
      return {
        id: n.id, type: 'spine', position: { x: p.x - W / 2, y: p.y - H / 2 },
        data: { node: n, stat: stats.get(n.id)!, dim: !!highlight && !highlight.has(n.id), lit: !!highlight?.has(n.id) },
      }
    })
    const edges: Edge[] = SPINE.flatMap((n) => n.to.map((t) => {
      // Curved, thin and neutral: eight incomes fan into AGI, and right-angled or
      // coloured edges turned that fan into a tangle. Only a highlighted issue colours its edges.
      const lit = !!highlight && (highlight.has(n.id) || highlight.has(t))
      return {
        id: `${n.id}-${t}`, source: n.id, target: t, type: 'default',
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: lit ? 'rgb(var(--c-accent))' : 'rgb(var(--c-faint))' },
        style: { stroke: lit ? 'rgb(var(--c-accent))' : 'rgb(var(--c-faint))', strokeWidth: lit ? 2 : 1.2, opacity: highlight && !lit ? 0.25 : 0.9 },
      }
    }))
    return { nodes, edges }
  }, [stats, highlight])

  return (
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodeClick={(_, n) => onPick((n.data as Data).node)}
      fitView fitViewOptions={{ padding: 0.04, maxZoom: 1.25 }} minZoom={0.3} maxZoom={1.6}
      nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} proOptions={{ hideAttribution: true }}>
      <Background gap={22} size={1} color="rgb(var(--c-line))" />
      <Controls showInteractive={false} position="bottom-left" />
      <FitOnResize padding={0.04} maxZoom={1.25} />
    </ReactFlow>
  )
}
