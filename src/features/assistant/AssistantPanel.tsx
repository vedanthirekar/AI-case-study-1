// "Ask Mira": the AI assistant, a chat docked beside the page. The model runs on the
// server; its tools run here, against this tab's workpaper. Answers cite refs,
// which render as chips that open the trace, the document or the issue.
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, isToolUIPart, getToolName, type UIMessage } from 'ai'
import { Icon, cx } from '../../components/ui'
import { useApp, useActor, useDerived, useModel } from '../../state/app'
import { resolveRef } from '../../lib/packet/refs'
import { fmtValue } from '../../lib/format'
import { C, traceHref } from '../../lib/paths'
import { useFindings } from '../findings'
import { usePeople } from '../people'
import { useTrace } from '../trace/useTrace'
import { runTool, type ToolCtx } from './tools'
import { buildContext } from './context'
import { useAssistant } from './store'

export default function AssistantPanel() {
  const open = useAssistant((s) => s.open)
  const close = useAssistant((s) => s.close)
  const take = useAssistant((s) => s.take)
  const pending = useAssistant((s) => s.pending)
  const m = useModel()
  const d = useDerived()
  const findings = useFindings()
  const events = useApp((s) => s.events)
  const simNow = useApp((s) => s.simNow)
  const me = useActor()
  const people = usePeople()
  const loc = useLocation()
  const [params] = useSearchParams()

  // The chat is created once; these refs give it the latest workpaper on every turn.
  const ctx = useRef<ToolCtx>(null!)
  ctx.current = { m, d, findings, events, simNow, name: (id) => people(id).name }
  const where = useRef({ path: loc.pathname, params })
  where.current = { path: loc.pathname, params }
  const meRef = useRef(me)
  meRef.current = me

  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/chat',
    body: () => ({ role: meRef.current.role, context: buildContext(ctx.current, meRef.current, where.current) }),
  }), [])

  const { messages, sendMessage, status, stop, setMessages, error, addToolOutput, clearError } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall({ toolCall }) {
      try {
        const output = runTool(ctx.current, toolCall.toolName, toolCall.input)
        void addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output })
      } catch (e) {
        void addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, state: 'output-error', errorText: (e as Error).message })
      }
    },
  })

  const busy = status === 'submitted' || status === 'streaming'
  const [input, setInput] = useState('')
  const send = (text: string) => {
    const t = text.trim()
    if (!t || busy) return
    clearError()
    void sendMessage({ text: t })
    setInput('')
  }

  // A question asked from elsewhere ("Ask about this").
  useEffect(() => { if (open && pending) { const q = take(); if (q) send(q) } })

  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [messages, status])

  if (!open) return null
  const client = me.role === 'client'
  return (
    <aside className="flex h-full w-[min(420px,36vw)] min-w-[320px] shrink-0 flex-col border-l border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-ai-soft text-ai"><Icon name="sparkle" size={15} /></span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-display text-title font-bold">Ask Mira <span className="ml-1 rounded bg-ai-soft px-1 align-middle text-[10px] font-bold uppercase tracking-wider text-ai">AI</span></div>
          <div className="text-micro text-muted">{client ? 'About your 2025 return' : 'Your AI assistant for this client file. Every answer cites its sources.'}</div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => { stop(); setMessages([]); clearError() }} title="New conversation" className="rounded-lg px-2 py-1 text-micro font-semibold text-muted hover:bg-slateSoft hover:text-ink">New</button>
        )}
        <button onClick={close} aria-label="Close" className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-slateSoft hover:text-ink"><Icon name="x" size={15} /></button>
      </div>

      <div className="pane min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && <Suggestions client={client} onPick={send} trace={params.get('trace')} />}
        {messages.map((msg, i) => <Message key={msg.id} msg={msg} client={client} settled={!(busy && i === messages.length - 1)} />)}
        {status === 'submitted' && <div className="flex items-center gap-2 text-micro text-muted"><span className="h-2 w-2 animate-pulse rounded-full bg-ai" />Thinking...</div>}
        {error && (
          <div className="rounded-lg border border-danger/40 bg-danger-soft/40 px-3 py-2 text-meta text-danger">
            The assistant could not answer: {error.message || 'network error'}.
          </div>
        )}
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="border-t border-line p-3">
        <div className="flex items-end gap-2 rounded-lg border border-line bg-bg px-2.5 py-2 focus-within:border-accent">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} placeholder={client ? 'Ask about your return...' : 'Ask about any number, document or issue...'}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent text-body outline-none placeholder:text-faint" />
          {busy
            ? <button type="button" onClick={stop} aria-label="Stop" className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-white"><Icon name="stop" size={14} /></button>
            : <button type="submit" disabled={!input.trim()} aria-label="Send" className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-white disabled:opacity-40"><Icon name="send" size={14} /></button>}
        </div>
        <p className="mt-1.5 text-micro text-faint">Read-only. Answers can be wrong: check the cited sources. Tax effects are estimates.</p>
      </form>
    </aside>
  )
}

function Suggestions({ client, onPick, trace }: { client: boolean; onPick: (q: string) => void; trace: string | null }) {
  const qs = client
    ? ['Why do I owe this amount?', 'What does the firm still need from me?', 'Has my return been filed?']
    : [
      ...(trace ? [`How was ${trace} built, and can I trust it?`] : []),
      'What are the three biggest problems with this return, and what do they cost?',
      'Which documents feed no line on the return, and why?',
      'Why is the California wage figure what it is?',
      'What is left before we can file?',
    ]
  return (
    <div className="space-y-2">
      <p className="text-meta text-muted">{client ? 'Ask in your own words. Answers come from your file.' : 'Ask about this client. Mira looks things up in the workpaper and cites every source, so you can click through and check.'}</p>
      {qs.map((q) => (
        <button key={q} onClick={() => onPick(q)} className="block w-full rounded-lg border border-line2 px-3 py-2 text-left text-meta text-ink transition hover:border-ai/50 hover:bg-ai-soft/30">{q}</button>
      ))}
    </div>
  )
}

const TOOL_LABEL: Record<string, (i: Record<string, unknown>) => string> = {
  get_line: (i) => `Read line ${i.key}`,
  search_lines: (i) => `Searched lines for "${i.query}"`,
  list_findings: (i) => `Listed ${i.status ?? 'open'} issues${i.area ? ` in ${i.area}` : ''}`,
  get_finding: (i) => `Read issue ${String(i.id).replace(/^finding:/, '')}`,
  list_documents: (i) => `Listed documents${i.status ? ` (${i.status})` : ''}${i.query ? ` for "${i.query}"` : ''}`,
  get_document: (i) => `Read ${i.id}${i.page ? ` page ${i.page}` : ''}`,
  search_documents: (i) => `Searched documents for "${i.query}"`,
  resolve_ref: (i) => `Looked up ${i.ref}`,
  get_client_communications: (i) => `Read client answers and messages${i.query ? ` about "${i.query}"` : ''}`,
  get_prior_year: (i) => `Read the 2024 return${i.query ? ` for "${i.query}"` : ''}`,
  get_activity: (i) => `Read workpaper history${i.query ? ` for "${i.query}"` : ''}`,
}

function Message({ msg, client, settled }: { msg: UIMessage; client: boolean; settled: boolean }) {
  if (msg.role === 'user') {
    const text = msg.parts.map((p) => (p.type === 'text' ? p.text : '')).join('')
    return <div className="ml-8 rounded-lg bg-accent-soft/60 px-3 py-2 text-body text-ink">{text}</div>
  }
  const tools = msg.parts.filter(isToolUIPart)
  // Non-breaking and other Unicode hyphens become plain ones, so ids like ev-0030 stay matchable.
  const texts = msg.parts.map((p) => (p.type === 'text' ? p.text.replace(/<tool_call>[\s\S]*?(<\/tool_call>|$)/g, '').replace(/[‐‑‒]/g, '-').trim() : ''))
  return (
    <div className="space-y-2">
      {tools.length > 0 && (
        <div className="space-y-0.5">
          {tools.map((p) => {
            const name = getToolName(p)
            const label = TOOL_LABEL[name]?.((p.input ?? {}) as Record<string, unknown>) ?? name
            const done = p.state === 'output-available'
            return (
              <div key={p.toolCallId} className="flex items-center gap-1.5 text-micro text-faint">
                <Icon name={done ? 'check' : p.state === 'output-error' ? 'alert' : 'search'} size={11} className={done ? 'text-good' : ''} />{label}
              </div>
            )
          })}
        </div>
      )}
      {/* Some models write a tool call out as text instead of making it; that markup is dropped above. */}
      {texts.map((t, i) => (t ? <Markdown key={i} text={t} client={client} /> : null))}
      {settled && !texts.some(Boolean) && <p className="text-meta text-muted">No answer came back. Try asking again, or more specifically.</p>}
    </div>
  )
}

// ---- a small markdown renderer: paragraphs, lists, bold, code, citations ----

function Markdown({ text, client }: { text: string; client: boolean }) {
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  const flush = () => {
    if (!list) return
    const Tag = list.ordered ? 'ol' : 'ul'
    blocks.push(<Tag key={blocks.length} className={cx('space-y-1 pl-5', list.ordered ? 'list-decimal' : 'list-disc')}>{list.items.map((t, i) => <li key={i}><Inline text={t} client={client} /></li>)}</Tag>)
    list = null
  }
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const li = line.match(/^\s*(?:([-*])|(\d+)[.)])\s+(.*)$/)
    if (li) {
      const ordered = !!li[2]
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] } }
      list.items.push(li[3])
      continue
    }
    flush()
    if (!line.trim()) continue
    const h = line.match(/^#{1,6}\s+(.*)$/)
    blocks.push(h
      ? <p key={blocks.length} className="font-semibold text-ink"><Inline text={h[1]} client={client} /></p>
      : <p key={blocks.length}><Inline text={line} client={client} /></p>)
  }
  flush()
  return <div className="space-y-2 text-body leading-relaxed text-ink">{blocks}</div>
}

const REF = /^(finding:[\w-]+|ev-\d+|D\d{2}|doc:D\d{2}#page\d+|qa-\d+|msg-\d+|call-\d+|py:\S+|agency:\S+|asset:\S+|household:\S+|ref:\S+|v\d+|[A-Za-z0-9-]+\.[A-Za-z0-9.()-]+)$/

/** Models write citations loosely: 【get_line:F1040.11】, ev0030. Bring them back to packet ids. */
const normalizeRef = (x: string) => x.trim().replace(/^(?:get|list|search)_\w+:|^resolve_ref:/, '').replace(/^ev(\d+)$/, 'ev-$1')

function Inline({ text, client }: { text: string; client: boolean }) {
  // Split on **bold**, `code` and [citations] (also 【citations】).
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]|【[^】]+】)/g)
  return (
    <>
      {parts.map((s, i) => {
        if (s.startsWith('**') && s.endsWith('**')) return <strong key={i}><Inline text={s.slice(2, -2)} client={client} /></strong>
        if (s.startsWith('`') && s.endsWith('`')) return <code key={i} className="rounded bg-slateSoft px-1 font-mono text-[0.9em]">{s.slice(1, -1)}</code>
        if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('【') && s.endsWith('】'))) {
          const ids = s.slice(1, -1).split(/\s*(?:[,;+]|\band\b)\s*/).map(normalizeRef)
          if (ids.length && ids.every((x) => REF.test(x))) {
            return client ? null : <Fragment key={i}>{ids.map((id) => <Cite key={id} id={id} />)}</Fragment>
          }
        }
        // Document and value ids are unambiguous, so they link even without brackets.
        if (client) return <Fragment key={i}>{s}</Fragment>
        return <Fragment key={i}>{s.split(/\b(D\d{2}|ev-\d{3,})\b/g).map((t, j) => (j % 2 ? <Cite key={j} id={t} /> : t))}</Fragment>
      })}
    </>
  )
}

function Cite({ id }: { id: string }) {
  const m = useModel()
  const findings = useFindings()
  const nav = useNavigate()
  const loc = useLocation()
  const { open } = useTrace()
  let title = id
  let go: (() => void) | null = null
  if (id.startsWith('finding:')) {
    const fid = id.slice(8)
    const f = findings.find((x) => x.id === fid)
    title = f ? f.title : 'Unknown issue'
    if (f) go = () => nav(C(`?f=${encodeURIComponent(fid)}`))
  } else {
    const r = resolveRef(m, id)
    title = `${r.title}${r.value != null && typeof r.value !== 'string' ? `: ${fmtValue(r.value)}` : ''} (${r.sub})`
    if (r.ref.kind === 'line' && r.found) {
      go = () => (/^\/clients\/[^/]+(\/(review|schedules))?\/?$/.test(loc.pathname) ? open(r.ref.id) : nav(traceHref(r.ref.id)))
    } else if (r.href && r.doc) go = () => nav(r.href!)
    if (!r.found) title = `${id}: not found in the workpaper`
  }
  const label = id.replace(/^finding:/, '').replace(/^doc:(D\d{2})#page(\d+)$/, '$1 p$2')
  const cls = 'mx-0.5 inline-flex items-center rounded border px-1 align-baseline font-mono text-[11px] leading-[1.5]'
  return go
    ? <button onClick={go} title={title} className={cx(cls, 'border-accent/30 bg-accent-soft/50 text-accent hover:border-accent')}>{label}</button>
    : <span title={title} className={cx(cls, 'border-line bg-bgtint text-muted')}>{label}</span>
}
