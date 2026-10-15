// What needs this person's attention, derived from the log (nothing is stored):
// approvals waiting, questions, answers, reopened sign-offs, assignments, and
// what others did since they last looked.
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Menu, { MenuLabel } from '../../components/Menu'
import { TopBarButton } from '../../components/shell/AppShell'
import { Icon } from '../../components/ui'
import { useApp, useActor, useDerived, useModel } from '../../state/app'
import { magnitude } from '../../lib/workpaper/effect'
import { AREAS } from '../../lib/packet/areas'
import { signoffState } from '../Signoffs'

interface Note { id: string; icon: string; text: string; href: string }

export function useNotifications(): Note[] {
  const m = useModel()
  const d = useDerived()
  const me = useActor()
  const events = useApp((s) => s.events)
  const lastSeen = useApp((s) => s.lastSeen[me.id] ?? 0)
  return useMemo(() => {
    const out: Note[] = []
    const thr = d.standards.partner_threshold
    if (me.role === 'reviewer' || me.role === 'partner') {
      const mine = d.adjustments.filter((a) => a.status === 'proposed' && a.by !== me.id && (me.role === 'partner' || magnitude(a.effect) <= thr))
      if (mine.length) out.push({ id: 'approve', icon: 'edit', text: `${mine.length} adjustment${mine.length > 1 ? 's' : ''} waiting for your approval`, href: '/review?tab=adjustments' })
    }
    if (me.role === 'client') {
      const q = d.threads.filter((t) => t.to === 'client' && !t.answered)
      if (q.length) out.push({ id: 'q-client', icon: 'chat', text: `${q.length} question${q.length > 1 ? 's' : ''} from your preparer`, href: '/client' })
      if (d.signoffs.some((s) => s.scope === 'return' && s.level === 'partner') && !d.filing.clientApproval) out.push({ id: 'sign', icon: 'edit', text: 'Your return is ready to approve and sign', href: '/client' })
      return out
    }
    const answers = d.threads.filter((t) => t.startedBy === me.id && t.answered && t.messages[t.messages.length - 1].by !== me.id)
    if (answers.length) out.push({ id: 'answers', icon: 'chat', text: `${answers.length} answer${answers.length > 1 ? 's' : ''} to your questions`, href: '/review?tab=questions' })
    const toStaff = d.threads.filter((t) => t.to === 'staff' && !t.answered && t.startedBy !== me.id)
    if (toStaff.length) out.push({ id: 'q-staff', icon: 'chat', text: `${toStaff.length} question${toStaff.length > 1 ? 's' : ''} from colleagues`, href: '/review?tab=questions' })
    for (const a of [...AREAS.map((x) => x.id), 'return']) {
      const st = signoffState(m, d, a)
      for (const l of st.levels) if (l.state === 'reopened' && l.last?.by === me.id) out.push({ id: `re-${a}-${l.level}`, icon: 'refresh', text: `Your ${l.level} sign-off on ${AREAS.find((x) => x.id === a)?.label ?? 'the whole return'} reopened`, href: a === 'return' ? '/filing' : `/return?area=${a}` })
    }
    for (const [scope, x] of d.assignments) if (x.assignee === me.id) out.push({ id: `as-${scope}`, icon: 'user', text: `Assigned to you: ${AREAS.find((a) => a.id === scope)?.label ?? scope}${x.due ? `, due ${x.due}` : ''}`, href: `/return?area=${scope}` })
    const blocking = d.notes.filter((n) => n.blocking && !n.resolved && n.by !== me.id)
    if (blocking.length && me.role === 'preparer') out.push({ id: 'blocking', icon: 'lock', text: `${blocking.length} blocking review note${blocking.length > 1 ? 's' : ''} to answer`, href: '/review?tab=notes' })
    const fresh = events.filter((e) => e.seq > lastSeen && e.actor !== me.id).length
    if (fresh) out.push({ id: 'fresh', icon: 'history', text: `${fresh} change${fresh > 1 ? 's' : ''} by others since you last looked`, href: '/changes' })
    return out
  }, [m, d, me, events, lastSeen])
}

export function NotificationBell() {
  const list = useNotifications()
  const nav = useNavigate()
  return (
    <Menu align="right" width={320} trigger={(_o, toggle) => <TopBarButton icon="bell" label="Notifications" count={list.length} onClick={toggle} />}>
      {(close) => (<>
        <MenuLabel>For you</MenuLabel>
        {list.length === 0 ? <div className="px-2.5 pb-2 text-meta text-muted">Nothing needs you right now.</div> : list.map((n) => (
          <button key={n.id} onClick={() => { close(); nav(n.href) }} className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-meta text-ink transition hover:bg-slateSoft">
            <Icon name={n.icon} size={14} className="mt-0.5 shrink-0 text-accent" />{n.text}
          </button>
        ))}
      </>)}
    </Menu>
  )
}
