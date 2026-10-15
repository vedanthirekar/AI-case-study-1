import { useApp } from '../state/app'
import { initials } from '../lib/format'

const TINTS = ['#1d4ed8', '#15803d', '#a16207', '#4338ca', '#b91c1c', '#0f766e', '#7c3aed', '#be185d']

/** Name and avatar data for any actor id. */
export function usePeople() {
  const actors = useApp((s) => s.actors)
  return (id: string) => {
    const i = actors.findIndex((a) => a.id === id)
    const a = actors[i]
    const name = a?.name ?? id
    return { id, name, role: a?.role, avatar: { initials: initials(name), tint: TINTS[(i < 0 ? 0 : i) % TINTS.length] } }
  }
}
