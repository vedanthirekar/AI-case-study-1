// App store: the packet model, the event log, who is acting, and the season
// clock. All writes go through dispatch(), which runs the rules first.
import { create } from 'zustand'
import { useMemo } from 'react'
import { loadPacket } from '../lib/packet/load'
import { buildModel, type Model } from '../lib/packet/model'
import type { Packet } from '../lib/packet/types'
import { IndexedDbStore, MemoryStore, type EventStore } from '../lib/store/eventStore'
import { derive, type Derived } from '../lib/workpaper/derive'
import { newId, type Action, type WPEvent } from '../lib/workpaper/events'
import { actorsOf, checkRules, type Actor, type Verdict } from '../lib/rules/rules'
import { setClientId } from '../lib/paths'

const LS = 'miraflores-workpaper:session'

/** Default: the day v3 was computed, when review work is in full swing. */
export const DEFAULT_SIM_NOW = '2026-06-23T12:00:00Z'

interface Session { actorId: string; simNow: string; lastSeen: Record<string, number> }

function readSession(): Session {
  const fallback: Session = { actorId: 'st-01', simNow: DEFAULT_SIM_NOW, lastSeen: {} }
  try {
    const raw = localStorage.getItem(LS)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch { return fallback }
}

function writeSession(s: Session) {
  try { localStorage.setItem(LS, JSON.stringify(s)) } catch { /* private mode: session is per tab */ }
}

interface AppState extends Session {
  status: 'loading' | 'ready' | 'error'
  error: string | null
  model: Model | null
  actors: Actor[]
  events: WPEvent[]
  store: EventStore | null
  init: () => Promise<void>
  setActor: (id: string) => void
  setSimNow: (iso: string) => void
  markSeen: () => void
  /** Validate and append one or more actions as one batch. Returns the verdict and the batch id. */
  dispatch: (actions: Action | Action[]) => Promise<Verdict & { batchId?: string; ids?: string[] }>
  /** Undo: append reversal events for these event ids. */
  undo: (eventIds: string[]) => Promise<Verdict>
  resetDemo: () => Promise<void>
  appendRaw: (events: WPEvent[]) => Promise<void>
}

let started = false

export const useApp = create<AppState>((set, get) => ({
  ...readSession(),
  status: 'loading',
  error: null,
  model: null,
  actors: [],
  events: [],
  store: null,

  init: async () => {
    if (started) return
    started = true
    try {
      const packet: Packet = await loadPacket()
      const model = buildModel(packet)
      setClientId(packet.packet.client_id)
      let store: EventStore
      try { store = new IndexedDbStore(packet.packet.client_id); await store.load() } catch { store = new MemoryStore() }
      const events = await store.load()
      store.subscribe((incoming) => {
        const have = new Set(get().events.map((e) => e.id))
        const fresh = incoming.filter((e) => !have.has(e.id))
        if (fresh.length) set({ events: [...get().events, ...fresh].sort((a, b) => a.seq - b.seq) })
      })
      set({ model, store, events, actors: actorsOf(model), status: 'ready' })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  setActor: (actorId) => { set({ actorId }); writeSession(pickSession(get())) },
  setSimNow: (simNow) => { set({ simNow }); writeSession(pickSession(get())) },
  markSeen: () => {
    const { events, actorId, lastSeen } = get()
    const top = events.length ? events[events.length - 1].seq : 0
    set({ lastSeen: { ...lastSeen, [actorId]: top } })
    writeSession(pickSession(get()))
  },

  dispatch: async (input) => {
    const { model, store, actorId, actors, simNow } = get()
    if (!model || !store) return { ok: false, reason: 'Still loading.' }
    const actor = actors.find((a) => a.id === actorId)
    if (!actor) return { ok: false, reason: 'Unknown person.' }
    const actions = Array.isArray(input) ? input : [input]
    let events = get().events
    const batchId = actions.length > 1 ? newId() : undefined
    const made: WPEvent[] = []
    // Time-based sequence: monotonic in this tab and roughly ordered across tabs.
    const last = events.length ? events[events.length - 1].seq : 0
    let seq = Math.max(Date.now() * 1000, last + 1)
    for (const a of actions) {
      const d = derive(events, model)
      const verdict = checkRules(model, d, actor, a, simNow, events)
      if (!verdict.ok) return verdict
      const e: WPEvent = { id: newId(), seq: seq++, at: new Date().toISOString(), simAt: simNow, actor: actor.id, type: a.type, refs: a.refs, payload: a.payload, batchId }
      made.push(e)
      events = [...events, e]
    }
    await store.append(made)
    set({ events: [...get().events, ...made] })
    return { ok: true, batchId, ids: made.map((e) => e.id) }
  },

  undo: async (eventIds) => {
    const actions: Action[] = eventIds.map((id) => ({ type: 'event.reversed', refs: [id], payload: { eventId: id } }))
    return get().dispatch(actions)
  },

  resetDemo: async () => {
    await get().store?.reset()
    set({ events: [], lastSeen: {} })
    writeSession(pickSession(get()))
  },

  appendRaw: async (events) => {
    await get().store?.append(events)
    set({ events: [...get().events, ...events].sort((a, b) => a.seq - b.seq) })
  },
}))

function pickSession(s: AppState): Session {
  return { actorId: s.actorId, simNow: s.simNow, lastSeen: s.lastSeen }
}

/** The model; only call below the ready gate. */
export function useModel(): Model {
  return useApp((s) => s.model)!
}

/** The projection of the event log, recomputed when the log changes. */
export function useDerived(): Derived {
  const events = useApp((s) => s.events)
  const model = useModel()
  return useMemo(() => derive(events, model), [events, model])
}

export function useActor(): Actor {
  const actorId = useApp((s) => s.actorId)
  const actors = useApp((s) => s.actors)
  return actors.find((a) => a.id === actorId) ?? actors[0]
}

/** Would this action be allowed right now? For disabling controls with a reason. */
export function useCan() {
  const model = useModel()
  const d = useDerived()
  const actor = useActor()
  const simNow = useApp((s) => s.simNow)
  const events = useApp((s) => s.events)
  return (a: Action): Verdict => checkRules(model, d, actor, a, simNow, events)
}
