// Sign-offs are fingerprints of what was signed. When anything underneath
// changes (a value, an adjustment's status, a blocking note), the fingerprint no
// longer matches and the sign-off shows as reopened, with what changed.
import { useMemo, useState } from 'react'
import StatusBadge from '../components/StatusBadge'
import { Avatar, Icon, Tooltip, cx } from '../components/ui'
import { useDerived, useModel } from '../state/app'
import { scopeSnapshot, hashOf, snapshotDiff, type Derived, type Signoff } from '../lib/workpaper/derive'
import type { Model } from '../lib/packet/model'
import { fmtDateTime } from '../lib/format'
import { SIGNOFF_STATE } from './vocab'
import { ActionButton } from './ActionButton'
import { usePeople } from './people'

const LEVELS = ['preparer', 'reviewer', 'partner'] as const
type Level = (typeof LEVELS)[number]

export interface LevelState { level: Level; state: 'none' | 'signed' | 'reopened'; last?: Signoff; changed: string[] }

export function signoffState(m: Model, d: Derived, scope: string): { hash: string; snapshot: Record<string, string | number>; levels: LevelState[] } {
  const snapshot = scopeSnapshot(m, d, scope)
  const hash = hashOf(snapshot)
  const levels = LEVELS.map((level) => {
    const all = d.signoffs.filter((s) => s.scope === scope && s.level === level)
    const last = all[all.length - 1]
    if (!last) return { level, state: 'none' as const, changed: [] }
    if (last.hash === hash) return { level, state: 'signed' as const, last, changed: [] }
    return { level, state: 'reopened' as const, last, changed: snapshotDiff(last.snapshot, snapshot) }
  })
  return { hash, snapshot, levels }
}

export function useSignoffs(scope: string) {
  const m = useModel()
  const d = useDerived()
  return useMemo(() => signoffState(m, d, scope), [m, d, scope])
}

export default function SignoffBar({ scope, label }: { scope: string; label: string }) {
  const { hash, snapshot, levels } = useSignoffs(scope)
  const people = usePeople()
  const [open, setOpen] = useState<Level | null>(null)
  const reopened = levels.find((l) => l.state === 'reopened')
  return (
    <div className={cx('rounded-xl2 border bg-surface', reopened ? 'border-ai/40' : 'border-line')}>
      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
        <span className="text-micro font-bold uppercase tracking-wider text-faint">Sign-off · {label}</span>
        {levels.map((l) => (
          <div key={l.level} className="flex items-center gap-1.5">
            <span className="text-meta capitalize text-muted">{l.level}</span>
            <button onClick={() => setOpen(open === l.level ? null : l.level)} className="flex items-center gap-1">
              <StatusBadge vocab={SIGNOFF_STATE} value={l.state} />
              {l.last && <Tooltip label={`${people(l.last.by).name}, ${fmtDateTime(l.last.at)}`}><Avatar user={people(l.last.by).avatar} size={18} /></Tooltip>}
            </button>
            {l.state !== 'signed' && (
              <ActionButton size="sm" variant={l.state === 'reopened' ? 'primary' : 'default'} done={`Signed off as ${l.level}`} side="bottom"
                actions={{ type: 'signoff.given', refs: [`scope:${scope}`], payload: { scope, level: l.level, hash, snapshot } }}>
                <Icon name="check-double" size={12} />{l.state === 'reopened' ? 'Sign again' : 'Sign'}
              </ActionButton>
            )}
          </div>
        ))}
        <span className="ml-auto font-mono text-micro text-faint" title="Fingerprint of everything this sign-off covers">#{hash}</span>
      </div>
      {open && (() => {
        const l = levels.find((x) => x.level === open)!
        if (l.state !== 'reopened') return null
        return (
          <div className="border-t border-line2 px-3 py-2 text-meta">
            <div className="mb-1 flex items-center gap-1.5 text-ai"><Icon name="refresh" size={13} />Reopened: {l.changed.length} item{l.changed.length > 1 ? 's' : ''} changed since {people(l.last!.by).name} signed</div>
            <ul className="space-y-0.5">{l.changed.slice(0, 12).map((k) => (
              <li key={k} className="flex gap-2"><span className="font-mono text-micro text-accent">{k.replace(/^adj:.*/, 'adjustment').replace(/^note:.*/, 'review note')}</span>
                <span className="tnum text-muted">{String(l.last!.snapshot[k] ?? 'none')} → <b className="text-ink">{String(snapshot[k] ?? 'removed')}</b></span></li>
            ))}</ul>
          </div>
        )
      })()}
    </div>
  )
}
