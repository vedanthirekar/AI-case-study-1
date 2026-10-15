// Where the event log lives. Screens never touch this directly; they go through
// the app store. The MVP keeps everything in this browser (IndexedDB) and tells
// other open tabs about new events, so two roles in two tabs see each other live.
// A RemoteStore (Postgres behind an API) would implement the same interface.
import { openDB, type IDBPDatabase } from 'idb'
import type { WPEvent } from '../workpaper/events'

export interface EventStore {
  load(): Promise<WPEvent[]>
  append(events: WPEvent[]): Promise<void>
  /** called with events appended by other tabs or devices */
  subscribe(onEvents: (events: WPEvent[]) => void): () => void
  reset(): Promise<void>
  putBlob(id: string, blob: Blob): Promise<void>
  getBlob(id: string): Promise<Blob | undefined>
}

const DB = 'miraflores-workpaper'
const CHANNEL = 'miraflores-workpaper-events'

type Msg = { kind: 'appended'; events: WPEvent[] } | { kind: 'reset' }

export class IndexedDbStore implements EventStore {
  private db: Promise<IDBPDatabase>
  private channel: BroadcastChannel | null

  constructor(private clientId: string) {
    this.db = openDB(DB, 1, {
      upgrade(db) {
        const ev = db.createObjectStore('events', { keyPath: 'id' })
        ev.createIndex('client_seq', ['clientId', 'seq'])
        db.createObjectStore('blobs')
      },
    })
    this.channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null
  }

  async load(): Promise<WPEvent[]> {
    const db = await this.db
    const all = (await db.getAll('events')) as (WPEvent & { clientId: string })[]
    return all.filter((e) => e.clientId === this.clientId).sort((a, b) => a.seq - b.seq).map(({ clientId: _c, ...e }) => e)
  }

  async append(events: WPEvent[]): Promise<void> {
    const db = await this.db
    const tx = db.transaction('events', 'readwrite')
    await Promise.all([...events.map((e) => tx.store.put({ ...e, clientId: this.clientId })), tx.done])
    this.channel?.postMessage({ kind: 'appended', events } satisfies Msg)
  }

  subscribe(onEvents: (events: WPEvent[]) => void): () => void {
    if (!this.channel) return () => {}
    const h = (e: MessageEvent<Msg>) => {
      if (e.data.kind === 'appended') onEvents(e.data.events)
      if (e.data.kind === 'reset') window.location.reload()
    }
    this.channel.addEventListener('message', h)
    return () => this.channel?.removeEventListener('message', h)
  }

  async reset(): Promise<void> {
    const db = await this.db
    await db.clear('events')
    await db.clear('blobs')
    this.channel?.postMessage({ kind: 'reset' } satisfies Msg)
  }

  async putBlob(id: string, blob: Blob) { await (await this.db).put('blobs', blob, id) }
  async getBlob(id: string) { return (await (await this.db).get('blobs', id)) as Blob | undefined }
}

/** Fallback when IndexedDB is unavailable (private windows in some browsers): memory only. */
export class MemoryStore implements EventStore {
  private events: WPEvent[] = []
  private blobs = new Map<string, Blob>()
  async load() { return [...this.events] }
  async append(e: WPEvent[]) { this.events.push(...e) }
  subscribe() { return () => {} }
  async reset() { this.events = []; this.blobs.clear() }
  async putBlob(id: string, b: Blob) { this.blobs.set(id, b) }
  async getBlob(id: string) { return this.blobs.get(id) }
}
