// A button that performs workpaper actions. It asks the rules first: when the
// current person may not act, it stays visible but disabled and says who can
// and why (DESIGN rule 8). Every save offers Undo.
import type { ReactNode } from 'react'
import { Btn, Tooltip } from '../components/ui'
import { useToast } from '../components/Toast'
import { useApp, useCan } from '../state/app'
import type { Action } from '../lib/workpaper/events'

type BtnProps = Parameters<typeof Btn>[0]

export function useRun() {
  const dispatch = useApp((s) => s.dispatch)
  const undo = useApp((s) => s.undo)
  const toast = useToast()
  return async (actions: Action | Action[], done: string, body?: string) => {
    const r = await dispatch(actions)
    if (!r.ok) { toast({ title: 'Not saved', body: r.reason, tone: 'danger' }); return false }
    toast({
      title: done, body, tone: 'good',
      action: { label: 'Undo', onClick: async () => {
        const u = await undo(r.ids ?? [])
        toast(u.ok ? { title: 'Undone', body: 'A reversing entry was added to the log.' } : { title: 'Could not undo', body: u.reason, tone: 'danger' })
      } },
    })
    return true
  }
}

export function ActionButton({ actions, done, body, children, onDone, disabledReason, side = 'top', ...btn }: Omit<BtnProps, 'onClick'> & {
  actions: Action | Action[] | (() => Action | Action[])
  done: string
  body?: string
  children: ReactNode
  onDone?: () => void
  /** extra precondition from the form (e.g. "enter a reason") */
  disabledReason?: string | null
  side?: 'top' | 'bottom' | 'bottom-end' | 'right'
}) {
  const can = useCan()
  const run = useRun()
  const list = typeof actions === 'function' ? null : Array.isArray(actions) ? actions : [actions]
  // Rules are checked on the first action; batches are re-checked one by one on save.
  const verdict = list?.length ? can(list[0]) : { ok: true as const }
  const reason = disabledReason || (!verdict.ok ? verdict.reason : null)
  const button = (
    <Btn {...btn} disabled={!!reason || btn.disabled}
      onClick={async () => { const a = typeof actions === 'function' ? actions() : actions; if (await run(a, done, body)) onDone?.() }}>
      {children}
    </Btn>
  )
  return reason ? <Tooltip label={reason} side={side}>{button}</Tooltip> : button
}
