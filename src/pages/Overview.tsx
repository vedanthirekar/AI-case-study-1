// Placeholder overview: proves the packet loads as delivered and the kit renders.
// Replaced by the real overview (return flow, readiness, deadlines) on Day 1.
import { useEffect } from 'react'
import { useShell } from '../components/shell/ShellContext'
import PageHeader from '../components/shell/PageHeader'
import { Card, Money, SkeletonRows, EmptyState } from '../components/ui'
import { usePacket } from '../lib/packet/load'

export default function Overview() {
  const { publish } = useShell()
  const { packet, error } = usePacket()

  useEffect(() => { publish({ crumbs: [{ label: 'Overview' }] }) }, [publish])

  if (error) return <EmptyState icon="alert" title="The packet did not load" body={error} />
  if (!packet) return <div className="mx-auto max-w-5xl px-6 py-6"><SkeletonRows rows={4} /></div>

  const v3 = packet.return_versions[packet.return_versions.length - 1]
  const fed = v3.summary.federal
  const ca = v3.summary.california

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
      <PageHeader eyebrow="Okafor-Lindqvist - 2025" icon="home" title="Overview"
        subtitle={`${packet.packet.name} - client ${packet.packet.client_id}`} />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Documents" value={packet.documents.length} />
        <Stat label="Extracted values" value={packet.extracted_values.length} />
        <Stat label="Engine versions" value={packet.return_versions.length} />
        <Stat label="Current version" text={`${v3.version} - ${v3.computed_at.slice(0, 10)}`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="text-micro font-bold uppercase tracking-wider text-faint">Federal (engine v3)</div>
          <Row label="Adjusted gross income" value={fed.agi} />
          <Row label="Taxable income" value={fed.taxable_income} />
          <Row label="Total tax" value={fed.total_tax} />
          <Row label="Payments" value={fed.payments} />
          <Row label="Balance due" value={fed.balance_due} />
        </Card>
        <Card className="p-4">
          <div className="text-micro font-bold uppercase tracking-wider text-faint">California (engine v3)</div>
          <Row label="California AGI" value={ca.ca_agi} />
          <Row label="Total tax" value={ca.total_tax} />
          <Row label="Payments" value={ca.payments} />
          <Row label="Balance due (negative is a refund)" value={ca.balance_due} />
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value, text }: { label: string; value?: number; text?: string }) {
  return (
    <Card className="p-4">
      <div className="text-micro font-bold uppercase tracking-wider text-faint">{label}</div>
      <div className="tnum mt-1 text-display font-semibold">{text ?? value?.toLocaleString('en-US')}</div>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b border-line2 py-1.5 text-body last:border-0">
      <span className="text-muted">{label}</span>
      <Money value={value} />
    </div>
  )
}
