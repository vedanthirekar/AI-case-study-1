// Questions to the client or colleagues. An answered question stays attached to
// the line it was about, so the answer becomes evidence for that number.
import { useState } from 'react'
import { Avatar, Icon, Tag, cx } from '../components/ui'
import { useActor, useDerived } from '../state/app'
import { newId } from '../lib/workpaper/events'
import { fmtDateTime } from '../lib/format'
import type { Thread } from '../lib/workpaper/derive'
import { ActionButton } from './ActionButton'
import { usePeople } from './people'
import { RefChip } from './RefChip'

export function ThreadList({ filter, empty = 'No questions yet.' }: { filter?: (t: Thread) => boolean; empty?: string }) {
  const d = useDerived()
  const list = d.threads.filter(filter ?? (() => true)).sort((a, b) => Number(a.answered) - Number(b.answered))
  if (!list.length) return <p className="py-4 text-center text-meta text-muted">{empty}</p>
  return <div className="space-y-3">{list.map((t) => <ThreadCard key={t.id} t={t} />)}</div>
}

export function ThreadCard({ t }: { t: Thread }) {
  const people = usePeople()
  const me = useActor()
  const [reply, setReply] = useState('')
  const replyTo: 'client' | 'staff' = me.role === 'client' ? 'staff' : t.to
  return (
    <div className={cx('rounded-xl2 border bg-surface', t.answered ? 'border-line' : 'border-warn/40')}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line2 px-3 py-2 text-micro text-muted">
        <Tag tone={t.answered ? 'good' : 'warn'}>{t.answered ? 'Answered' : 'Waiting for an answer'}</Tag>
        <span>{t.to === 'client' ? 'Question to the client' : 'Question to colleagues'}</span>
        <span className="ml-auto flex gap-1">{t.refs.filter((r) => !r.startsWith('thread:')).slice(0, 2).map((r) => <span key={r} className="font-mono text-accent">{r}</span>)}</span>
      </div>
      <ul className="space-y-2 px-3 py-2">{t.messages.map((x) => {
        const p = people(x.by)
        return (
          <li key={x.id} className="flex items-start gap-2 text-meta">
            <Avatar user={p.avatar} size={22} />
            <div className="min-w-0"><div><b>{p.name}</b> <span className="text-micro text-faint">{fmtDateTime(x.at)}</span></div><p className="text-ink">{x.text}</p></div>
          </li>
        )
      })}</ul>
      <div className="flex gap-1.5 border-t border-line2 px-3 py-2">
        <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder={me.role === 'client' ? 'Your answer' : 'Reply'}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-meta placeholder:text-faint" />
        <ActionButton size="sm" variant="primary" done="Sent" disabledReason={!reply.trim() ? 'Write a reply first.' : null}
          actions={{ type: 'thread.message', refs: t.refs, payload: { threadId: t.id, to: replyTo, text: reply } }} onDone={() => setReply('')}>
          <Icon name="send" size={12} />Send
        </ActionButton>
      </div>
    </div>
  )
}

/** Start a question about a line (or anything else). */
export function AskForm({ refs, compact = false }: { refs: string[]; compact?: boolean }) {
  const [text, setText] = useState('')
  const [to, setTo] = useState<'client' | 'staff'>('client')
  const [id, setId] = useState(() => newId())
  return (
    <div className="space-y-2">
      {!compact && refs[0] && <RefChip id={refs[0]} compact />}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="What do you need to know?"
        className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-body placeholder:text-faint" />
      <div className="flex items-center gap-2">
        <select value={to} onChange={(e) => setTo(e.target.value as 'client' | 'staff')} className="rounded-lg border border-line bg-surface px-2 py-1 text-meta">
          <option value="client">Ask the client</option><option value="staff">Ask a colleague</option>
        </select>
        <ActionButton size="sm" variant="primary" done={to === 'client' ? 'Question sent to the client' : 'Question sent'} disabledReason={!text.trim() ? 'Write the question first.' : null}
          actions={{ type: 'thread.message', refs: [...refs, `thread:${id}`], payload: { threadId: id, to, text } }} onDone={() => { setText(''); setId(newId()) }}>
          <Icon name="chat" size={12} />Send question
        </ActionButton>
      </div>
    </div>
  )
}
