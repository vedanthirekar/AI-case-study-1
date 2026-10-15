// Attach any file as evidence to a line. The file is stored with the log (in
// this browser for the MVP; object storage in production) and the attachment
// itself is an event, so who added what, when, stays on the record.
import { useRef, useState } from 'react'
import { Icon, Tooltip } from '../components/ui'
import { useApp, useCan, useDerived } from '../state/app'
import { newId } from '../lib/workpaper/events'
import { fmtDateTime } from '../lib/format'
import { useToast } from '../components/Toast'
import { usePeople } from './people'

const MAX = 10 * 1024 * 1024

export function Attachments({ refId }: { refId: string }) {
  const d = useDerived()
  const store = useApp((s) => s.store)
  const dispatch = useApp((s) => s.dispatch)
  const can = useCan()
  const toast = useToast()
  const people = usePeople()
  const input = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState('')
  const list = d.attachments.filter((a) => a.refs.includes(refId))
  const probe = can({ type: 'attachment.added', refs: [refId], payload: { name: 'x', size: 1, mime: 'x', blobId: 'x' } })

  const onFile = async (f: File | undefined) => {
    if (!f || !store) return
    if (f.size > MAX) { toast({ title: 'File too large', body: 'Up to 10 MB in this prototype.', tone: 'danger' }); return }
    const blobId = newId()
    await store.putBlob(blobId, f)
    const r = await dispatch({ type: 'attachment.added', refs: [refId], payload: { name: f.name, size: f.size, mime: f.type || 'application/octet-stream', blobId, note: note || undefined } })
    toast(r.ok ? { title: 'Attached as evidence', body: f.name, tone: 'good' } : { title: 'Not attached', body: r.reason, tone: 'danger' })
    setNote('')
    if (input.current) input.current.value = ''
  }
  const open = async (blobId: string, name: string) => {
    const b = await store?.getBlob(blobId)
    if (!b) { toast({ title: 'File not in this browser', body: 'Attachments live with the browser that added them in this prototype.', tone: 'warn' }); return }
    const url = URL.createObjectURL(b)
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  return (
    <div className="space-y-2">
      {list.length > 0 && (
        <ul className="space-y-1">{list.map((a) => (
          <li key={a.id}>
            <button onClick={() => open(a.blobId, a.name)} className="flex w-full items-center gap-2 rounded-lg border border-line2 bg-surface px-2.5 py-1.5 text-left text-meta transition hover:border-accent/50">
              <Icon name="doc" size={14} className="text-faint" />
              <span className="min-w-0 flex-1"><span className="block truncate text-ink">{a.name}</span>
                <span className="block text-micro text-muted">{people(a.by).name} · {fmtDateTime(a.at)} · {Math.ceil(a.size / 1024)} KB{a.note ? ` · ${a.note}` : ''}</span></span>
              <Icon name="upload" size={13} className="rotate-180 text-faint" />
            </button>
          </li>
        ))}</ul>
      )}
      <div className="flex items-center gap-1.5">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What it shows (optional)"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-meta placeholder:text-faint" />
        <input ref={input} type="file" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Tooltip label={probe.ok ? 'Attach a file (statement, letter, photo...)' : probe.reason}>
          <button onClick={() => input.current?.click()} disabled={!probe.ok}
            className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-meta font-semibold text-muted transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50">
            <Icon name="upload" size={13} />Attach
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
