// Top-bar tools: who you are, what day it is in the season, search, demo controls.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Menu, { MenuItem, MenuDivider, MenuLabel } from '../../components/Menu'
import Modal from '../../components/Modal'
import CommandPalette, { type PaletteItem } from '../../components/CommandPalette'
import { Avatar, Btn, Icon, Kbd, Tag, cx } from '../../components/ui'
import { useApp, useActor, useModel } from '../../state/app'
import { ROLE_LABEL } from '../../lib/rules/rules'
import { fmtDate, fmtValue } from '../../lib/format'
import { usePeople } from '../people'
import { useFindings } from '../findings'
import { useToast } from '../../components/Toast'
import { seedEvents, SEED_SIM_NOW } from '../../lib/demo/seed'
import { reviewHref, traceHref, docHref } from '../../lib/paths'

export function RoleSwitcher() {
  const actors = useApp((s) => s.actors)
  const setActor = useApp((s) => s.setActor)
  const simNow = useApp((s) => s.simNow)
  const me = useActor()
  const people = usePeople()
  const toast = useToast()
  const staff = actors.filter((a) => a.role !== 'client')
  const clients = actors.filter((a) => a.role === 'client')
  const row = (a: (typeof actors)[number], close: () => void) => {
    const inactive = simNow.slice(0, 10) < a.activeFrom
    return (
      <MenuItem key={a.id} icon={a.id === me.id ? 'check' : 'user'} onClick={() => { setActor(a.id); close(); toast({ title: `Now acting as ${a.name}`, body: ROLE_LABEL[a.role] }) }}
        hint={inactive ? `joins ${a.activeFrom.slice(0, 7)}` : !a.clearance && a.role !== 'client' ? 'no clearance' : ROLE_LABEL[a.role]}>
        {a.name}
      </MenuItem>
    )
  }
  return (
    <Menu align="right" width={300} trigger={(_open, toggle) => (
      <button onClick={toggle} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1 transition hover:border-accent/50">
        <Avatar user={people(me.id).avatar} size={24} />
        <span className="text-left leading-tight"><span className="block text-meta font-semibold">{me.name}</span><span className="block text-micro text-muted">{ROLE_LABEL[me.role]}</span></span>
        <Icon name="chevron-down" size={13} className="text-faint" />
      </button>
    )}>
      {(close) => (<>
        <MenuLabel>Act as (role switcher)</MenuLabel>
        {staff.map((a) => row(a, close))}
        <MenuDivider />
        <MenuLabel>Client</MenuLabel>
        {clients.map((a) => row(a, close))}
      </>)}
    </Menu>
  )
}

export function SeasonClock() {
  const m = useModel()
  const simNow = useApp((s) => s.simNow)
  const setSimNow = useApp((s) => s.setSimNow)
  const toast = useToast()
  const marks = m.timeline.map((t) => ({ at: t.at, label: t.event.replace(/_/g, ' '), id: t.id }))
  const pick = (at: string, label: string) => {
    // a minute after the event, so the event itself has happened
    const iso = new Date(Date.parse(at) + 60000).toISOString()
    setSimNow(iso)
    toast({ title: `Season clock: ${fmtDate(iso)}`, body: `Just after: ${label}` })
  }
  return (
    <Menu align="right" width={340} trigger={(_open, toggle) => (
      <button onClick={toggle} title="Season clock: replay the timeline" className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-meta font-semibold transition hover:border-accent/50">
        <Icon name="clock" size={14} className="text-accent" /><span className="tnum">{fmtDate(simNow)}</span><Icon name="chevron-down" size={12} className="text-faint" />
      </button>
    )}>
      {(close) => (
        <div className="pane max-h-[70vh] overflow-y-auto">
          <MenuLabel>Season clock: jump to just after</MenuLabel>
          {marks.map((x) => {
            const past = x.at <= simNow
            return (
              <button key={x.id} onClick={() => { pick(x.at, x.label); close() }}
                className={cx('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-meta transition hover:bg-slateSoft', past ? 'text-ink' : 'text-muted')}>
                <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', past ? 'bg-accent' : 'bg-line')} />
                <span className="tnum w-24 shrink-0 text-micro text-muted">{fmtDate(x.at)}</span>
                <span className="min-w-0 flex-1 truncate capitalize">{x.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </Menu>
  )
}

export function GlobalSearch() {
  const m = useModel()
  const findings = useFindings()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const search = (q: string): PaletteItem[] => {
    const s = q.toLowerCase()
    const out: PaletteItem[] = []
    for (const f of findings) if (f.title.toLowerCase().includes(s)) out.push({ id: f.id, group: 'Findings', icon: 'alert', label: f.title, sub: f.check, onSelect: () => nav(reviewHref(`?f=${encodeURIComponent(f.id)}`)) })
    for (const k of m.current.order) {
      const l = m.current.lines.get(k)!
      if (k.toLowerCase().includes(s) || l.label.toLowerCase().includes(s)) out.push({ id: k, group: 'Return lines', icon: 'grid', label: l.label, sub: k, hint: fmtValue(l.value), onSelect: () => nav(traceHref(k)) })
      if (out.length > 60) break
    }
    for (const d of m.packet.documents) if (`${d.id} ${d.title} ${d.issuer}`.toLowerCase().includes(s)) out.push({ id: d.id, group: 'Documents', icon: 'doc', label: d.title, sub: `${d.id} · ${d.document_type}`, onSelect: () => nav(docHref(d.id)) })
    for (const e of m.packet.extracted_values) {
      if (out.length > 120) break
      if (e.id === s || (typeof e.value === 'string' && e.value.toLowerCase().includes(s) && !['ssn', 'account_number'].includes(e.value_type))) out.push({ id: e.id, group: 'Document values', icon: 'doc', label: `${e.label}: ${e.value}`, sub: `${e.document_id} p${e.page} · ${e.id}`, onSelect: () => nav(docHref(e.document_id, `?ev=${e.id}`)) })
    }
    for (const x of [...m.packet.client.questionnaire.map((q2) => ({ id: q2.id, t: `${q2.question} ${q2.answer}` })), ...m.packet.client.messages.map((x2) => ({ id: x2.id, t: x2.text }))]) {
      if (x.t.toLowerCase().includes(s)) out.push({ id: x.id, group: 'Client answers and messages', icon: 'chat', label: x.t.slice(0, 90), sub: x.id })
    }
    // A few of each kind, so a payer's name shows its documents too, not only the first fifty lines.
    const per = new Map<string, number>()
    return out.filter((x) => { const g = x.group ?? ''; const n = (per.get(g) ?? 0) + 1; per.set(g, n); return n <= 8 })
  }
  return (
    <>
      <button onClick={() => setOpen(true)} className="hidden items-center gap-2 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-meta text-faint transition hover:border-accent/50 md:flex">
        <Icon name="search" size={14} />Search lines, documents, findings<Kbd>Ctrl K</Kbd>
      </button>
      <CommandPalette search={search} open={open} onOpenChange={setOpen} placeholder="Search lines, documents, values, findings, client answers..." />
    </>
  )
}

/** Replace this browser's workpaper with a week of mid-season review work. */
export function useLoadDemo() {
  const resetDemo = useApp((s) => s.resetDemo)
  const appendRaw = useApp((s) => s.appendRaw)
  const setSimNow = useApp((s) => s.setSimNow)
  const m = useModel()
  const toast = useToast()
  // Keeps whoever is acting: the sample work is the same whichever role views it.
  return async () => {
    await resetDemo()
    await appendRaw(seedEvents(m))
    setSimNow(SEED_SIM_NOW)
    toast({ title: 'Sample work loaded', body: 'A return halfway through review, as of June 26, 2026.' })
  }
}

export function DemoMenu() {
  const resetDemo = useApp((s) => s.resetDemo)
  const events = useApp((s) => s.events)
  const [confirm, setConfirm] = useState(false)
  const toast = useToast()
  const loadDemo = useLoadDemo()
  return (
    <>
      <Menu align="right" width={260} trigger={(_open, toggle) => (
        <button onClick={toggle} title="Demo controls" className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-slateSoft hover:text-ink"><Icon name="refresh" size={17} /></button>
      )}>
        {(close) => (<>
          <MenuLabel>This browser's sandbox</MenuLabel>
          <div className="px-2.5 pb-2 text-micro text-muted">{events.length} entries in the workpaper log. Saved in this browser only.</div>
          <MenuItem icon="play" onClick={() => { close(); void loadDemo() }}>Load mid-season demo</MenuItem>
          <MenuItem icon="refresh" danger onClick={() => { close(); setConfirm(true) }}>Reset to the raw packet</MenuItem>
        </>)}
      </Menu>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Reset the workpaper?" tone="danger" icon="alert"
        actions={<><Btn variant="ghost" onClick={() => setConfirm(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={async () => { await resetDemo(); setConfirm(false); toast({ title: 'Workpaper reset', body: 'Back to the packet as delivered.' }) }}>Reset</Btn></>}>
        Every verification, adjustment, note and sign-off in this browser is erased. The packet itself is never changed. Other open tabs reload.
      </Modal>
    </>
  )
}

export function LiveBadge() {
  return <Tag tone="good" dot className="hidden xl:inline-flex">Live across tabs</Tag>
}
