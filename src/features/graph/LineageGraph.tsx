// Interactive lineage graph (React Flow + dagre layout). Click a line to re-center
// on it, a document value to open the page with the field highlighted.
import { memo, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ReactFlow, Background, Controls, Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Icon, cx } from '../../components/ui'
import { useDerived, useModel } from '../../state/app'
import { useFindings, findingsByLine } from '../findings'
import { docHref } from '../../lib/paths'
import FitOnResize from './FitOnResize'
import { buildLineage, type NodeData, type LineData, type EvData, type RefData, type MoreData, type LineageOptions } from './buildLineage'

const STATE_STYLE: Record<LineData['state'], { ring: string; chip: string; label: string }> = {
  unverified: { ring: 'border-line', chip: 'text-muted', label: 'Unverified' },
  verified: { ring: 'border-good', chip: 'text-good', label: 'Verified' },
  adjusted: { ring: 'border-accent', chip: 'text-accent', label: 'Adjusted' },
  flagged: { ring: 'border-warn', chip: 'text-warn', label: 'Flagged' },
  blocking: { ring: 'border-danger', chip: 'text-danger', label: 'Blocks filing' },
}

const Ports = () => (<><Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-line" /><Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-line" /></>)

const LineNode = memo(({ data }: NodeProps<Node<LineData>>) => {
  const s = STATE_STYLE[data.state]
  return (
    <div className={cx('w-[210px] cursor-pointer rounded-md border-2 bg-surface px-2.5 py-1.5 shadow-sm transition hover:shadow-md', s.ring, data.focus && 'ring-4 ring-accent/25')}>
      <Ports />
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] text-faint">{data.key}</span>
        <span className={cx('ml-auto text-[10px] font-semibold', s.chip)}>{s.label}</span>
        {data.findings > 0 && <Icon name="alert" size={11} className="text-warn" />}
      </div>
      <div className="truncate text-meta font-medium text-ink" title={data.label}>{data.label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className={cx('tnum text-body font-semibold', data.state === 'adjusted' && 'text-accent')}>{data.value}</span>
        {data.original && <span className="tnum text-[10px] text-faint line-through">{data.original}</span>}
      </div>
    </div>
  )
})

const EvNode = memo(({ data }: NodeProps<Node<EvData>>) => {
  const tone = data.confidence >= 0.9 ? 'text-good' : data.confidence >= 0.6 ? 'text-warn' : 'text-danger'
  return (
    <div className="w-[210px] cursor-pointer rounded-md border border-dashed border-line bg-bgtint px-2.5 py-1.5 transition hover:border-accent">
      <Ports />
      <div className="flex items-center gap-1.5 text-[10px] text-muted"><Icon name="doc" size={11} /><span className="font-mono">{data.doc} p{data.page}</span>
        <span className={cx('ml-auto tnum', tone)}>{Math.round(data.confidence * 100)}% read</span></div>
      <div className="truncate text-meta text-ink" title={data.label}>{data.label}</div>
      <div className="tnum text-meta font-semibold">{data.value}</div>
    </div>
  )
})

const RefNode = memo(({ data }: NodeProps<Node<RefData>>) => (
  <div className={cx('w-[200px] rounded-md border border-line bg-surface2 px-2.5 py-1.5', data.href && 'cursor-pointer hover:border-accent')}>
    <Ports />
    <div className="flex items-center gap-1.5 text-[10px] text-muted"><Icon name={data.icon} size={11} /><span className="truncate">{data.sub}</span></div>
    <div className="truncate text-meta text-ink" title={data.label}>{data.label}{data.value ? <span className="ml-1 text-muted">· {data.value}</span> : null}</div>
  </div>
))

const MoreNode = memo(({ data }: NodeProps<Node<MoreData>>) => (
  <div className="w-[140px] cursor-pointer rounded-full border border-line bg-surface px-3 py-1.5 text-center text-micro font-semibold text-accent hover:border-accent">
    <Ports />+{data.count} {data.what}
  </div>
))

const nodeTypes = { line: LineNode, ev: EvNode, ref: RefNode, more: MoreNode }

export default function LineageGraph({ focus, options, onFocus }: { focus: string; options: LineageOptions; onFocus: (key: string) => void }) {
  const m = useModel()
  const d = useDerived()
  const findings = useFindings()
  const nav = useNavigate()
  const byLine = useMemo(() => findingsByLine(findings), [findings])
  const { nodes, edges, truncated } = useMemo(() => buildLineage(m, d, byLine, focus, options), [m, d, byLine, focus, options])

  const onClick = (_: unknown, n: Node) => {
    const data = n.data as NodeData
    if (data.kind === 'line') onFocus(data.key)
    else if (data.kind === 'more') onFocus(data.parent)
    else if (data.kind === 'ev') nav(docHref(data.doc, `?ev=${data.id}`))
    else if (data.kind === 'ref' && data.href && !data.href.startsWith('?')) nav(data.href)
  }

  return (
    <div className="relative h-full w-full">
      <ReactFlow key={`${focus}-${options.up}-${options.down}-${options.cap}`} nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodeClick={onClick}
        fitView fitViewOptions={{ padding: 0.15, maxZoom: 1.1 }} minZoom={0.15} maxZoom={1.8}
        nodesDraggable nodesConnectable={false} elementsSelectable={false} proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ style: { stroke: 'rgb(var(--c-faint))', strokeWidth: 1.2 } }}>
        <Background gap={20} size={1} color="rgb(var(--c-line))" />
        <Controls showInteractive={false} position="bottom-left" />
        <FitOnResize padding={0.15} />
      </ReactFlow>
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-line bg-surface/90 px-2.5 py-1 text-micro text-muted">
        {nodes.length} nodes · {edges.length} links{truncated && ' · capped for readability'}
      </div>
    </div>
  )
}
