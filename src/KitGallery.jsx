// Every kit component in use, with placeholder content. A visual reference and a
// smoke test: if this page renders, the kit is wired correctly.
import { useEffect, useState } from 'react'
import { useShell } from './components/shell/ShellContext'
import PageHeader from './components/shell/PageHeader'
import { TopBarButton } from './components/shell/AppShell'
import Drawer from './components/Drawer'
import Modal from './components/Modal'
import Menu, { MenuItem, MenuDivider, MenuLabel } from './components/Menu'
import Tabs from './components/Tabs'
import CommandPalette from './components/CommandPalette'
import { useToast } from './components/Toast'
import { Table, Th, Tr, Td, TGroup } from './components/Table'
import StatusBadge, { StatusLegend } from './components/StatusBadge'
import { Btn, Card, Tag, Money, Icon, EmptyState } from './components/ui'

const STATE = {
  unverified: { label: 'Unverified', tone: 'muted', icon: 'eye', desc: 'Read by the pipeline; no person has checked it.' },
  verified: { label: 'Verified', tone: 'good', icon: 'check', desc: 'A person agreed it to its source.' },
  open: { label: 'Open', tone: 'warn', icon: 'alert', desc: 'Has an unresolved question or note.' },
  blocking: { label: 'Blocks filing', tone: 'danger', icon: 'lock', desc: 'Must be resolved before filing.' },
}

const ROWS = [
  { key: 'A.1', label: 'Example line one', amount: 212400, state: 'verified' },
  { key: 'A.2', label: 'Example line two', amount: 1840, state: 'unverified' },
  { key: 'B.1', label: 'Example line three', amount: -15957, state: 'open' },
  { key: 'B.2', label: 'Example line four', amount: 53020, state: 'blocking' },
]

export default function KitGallery() {
  const { publish } = useShell()
  const toast = useToast()
  const [tab, setTab] = useState('table')
  const [sel, setSel] = useState('A.1')
  const [drawer, setDrawer] = useState(false)
  const [modal, setModal] = useState(false)

  useEffect(() => {
    publish({
      crumbs: [{ label: 'Home', to: '/' }, { label: 'Component kit' }],
      rail: <div className="space-y-3"><div className="text-micro font-bold uppercase tracking-wider text-faint">Right rail</div>
        <Card className="p-3 text-body text-muted">Pages fill this with useShell().publish({'{ rail }'}).</Card></div>,
    })
  }, [publish])

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
      <PageHeader eyebrow="Reference" icon="grid" title="Component kit" subtitle="Every shared component, with placeholder data."
        actions={<>
          <TopBarButton icon="bell" label="Notifications" count={3} />
          <Btn onClick={() => setDrawer(true)}><Icon name="panel" size={14} />Drawer</Btn>
          <Btn onClick={() => setModal(true)}>Modal</Btn>
          <Btn variant="primary" onClick={() => toast({ title: '4 lines verified', body: 'Agreed to source documents.', tone: 'good', action: { label: 'Undo', onClick: () => toast({ title: 'Undone' }) } })}>
            <Icon name="check" size={14} />Toast with undo
          </Btn>
          <Menu align="right" trigger={(open, toggle) => <Btn onClick={toggle}>Menu<Icon name="chevron-down" size={14} /></Btn>}>
            {(close) => (<>
              <MenuLabel>Actions</MenuLabel>
              <MenuItem icon="check" hint="V" onClick={close}>Verify</MenuItem>
              <MenuItem icon="note" onClick={close}>Add note</MenuItem>
              <MenuDivider />
              <MenuItem icon="x" danger disabled reason="Only a reviewer can reject.">Reject</MenuItem>
            </>)}
          </Menu>
        </>} />

      <Tabs value={tab} onChange={setTab} items={[
        { key: 'table', label: 'Dense table', icon: 'grid' },
        { key: 'badges', label: 'Badges', icon: 'check', count: 4 },
        { key: 'empty', label: 'Empty state', icon: 'compass', count: 2, countTone: 'warn' },
      ]} />

      {tab === 'table' && (
        <Table dense className="max-h-80">
          <thead><tr><Th>Key</Th><Th>Label</Th><Th>State</Th><Th num>Amount</Th></tr></thead>
          <tbody>
            <TGroup colSpan={4} right="2 lines">Group A</TGroup>
            {ROWS.slice(0, 2).map((r) => (
              <Tr key={r.key} onClick={() => setSel(r.key)} selected={sel === r.key}>
                <Td mono>{r.key}</Td><Td>{r.label}</Td><Td><StatusBadge vocab={STATE} value={r.state} /></Td><Td num><Money value={r.amount} /></Td>
              </Tr>
            ))}
            <TGroup colSpan={4} right="2 lines">Group B</TGroup>
            {ROWS.slice(2).map((r) => (
              <Tr key={r.key} onClick={() => setSel(r.key)} selected={sel === r.key}>
                <Td mono>{r.key}</Td><Td>{r.label}</Td><Td><StatusBadge vocab={STATE} value={r.state} /></Td><Td num><Money value={r.amount} /></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {tab === 'badges' && (
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            <Tag tone="good" dot>good</Tag><Tag tone="warn" dot>warn</Tag><Tag tone="danger" dot>danger</Tag>
            <Tag tone="accent" dot>accent</Tag><Tag tone="ai" dot>ai</Tag><Tag tone="muted" dot>muted</Tag>
            <StatusBadge vocab={STATE} value="unverified" suffix="0.98" />
          </div>
          <StatusLegend vocab={STATE} title="Legend" />
        </Card>
      )}

      {tab === 'empty' && <Card><EmptyState icon="check-double" title="Nothing open" body="Every line is verified." /></Card>}

      <p className="text-body text-muted">Press <b className="text-ink">Ctrl K</b> for the command palette.</p>

      <CommandPalette search={(q) => ROWS
        .filter((r) => `${r.key} ${r.label}`.toLowerCase().includes(q.toLowerCase()))
        .map((r) => ({ id: r.key, group: 'Lines', icon: 'grid', label: r.label, sub: r.key, hint: r.amount.toLocaleString('en-US'), onSelect: () => { setTab('table'); setSel(r.key) } }))} />

      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Side panel" icon="panel"
        footer={<Btn variant="primary" className="w-full" onClick={() => setDrawer(false)}>Done</Btn>}>
        <div className="p-4 text-body text-muted">Drawer body. Closes on Escape or a click outside.</div>
      </Drawer>

      <Modal open={modal} onClose={() => setModal(false)} title="Confirm an action?" tone="warn" icon="alert"
        actions={<><Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn><Btn variant="primary" onClick={() => setModal(false)}>Confirm</Btn></>}>
        Modal body text explaining the consequence of the action.
      </Modal>
    </div>
  )
}
