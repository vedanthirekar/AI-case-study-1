// Command palette (Ctrl/Cmd+K) - NEW. The previous project only had an inline
// search dropdown; this keeps that dropdown's result-row styling and keyboard
// shortcut, in a centered overlay with arrow-key navigation.
//
// It does no searching of its own: pass `search(query)` returning items, so the
// app decides what is searchable (lines, documents, people, notes, commands).
//
//   <CommandPalette search={(q) => [
//     { id: 'F1040.1a', group: 'Lines', icon: 'grid', label: 'Wages', sub: 'F1040.1a', hint: '212,400', onSelect: () => nav('/line/F1040.1a') },
//   ]} />
import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon, Kbd, cx } from './ui'

export default function CommandPalette({ search, placeholder = 'Search or jump to...', open: openProp, onOpenChange }) {
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (v) => { setOpenState(v); onOpenChange?.(v) }
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    const k = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(!open) }
      else if (e.key === 'Escape' && open) setOpen(false)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 0) } }, [open])

  const results = useMemo(() => (q.trim() ? (search?.(q.trim()) || []).slice(0, 50) : []), [q, search])
  useEffect(() => setIdx(0), [q])

  const pick = (r) => { setOpen(false); r?.onSelect?.() }
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); pick(results[idx]) }
  }

  // group headings, in first-seen order
  let lastGroup = null

  // Portalled to <body> so page layout can't shift it (see Drawer).
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
          className="fixed inset-0 z-[60] bg-scrim/40 px-4 pt-[12vh]" onClick={() => setOpen(false)}>
          <motion.div role="dialog" aria-modal="true" aria-label="Command palette"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.14 }}
            onClick={(e) => e.stopPropagation()}
            className="mx-auto w-full max-w-xl overflow-hidden rounded-xl2 border border-line bg-surface shadow-e3">
            <div className="flex items-center gap-2 border-b border-line px-3.5 py-3 text-faint">
              <Icon name="search" size={16} />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
                placeholder={placeholder}
                className="w-full bg-transparent text-lead text-ink outline-none placeholder:text-faint" />
              <Kbd>Esc</Kbd>
            </div>

            <div className="pane max-h-[min(60vh,420px)] overflow-y-auto p-1.5">
              {!q.trim() && <div className="px-3 py-6 text-center text-body text-muted">Type to search.</div>}
              {q.trim() && results.length === 0 && (
                <div className="px-3 py-6 text-center text-body text-muted">No matches for "{q}".</div>
              )}
              {results.map((r, i) => {
                const heading = r.group && r.group !== lastGroup ? r.group : null
                lastGroup = r.group
                return (
                  <div key={`${r.group || ''}:${r.id}`}>
                    {heading && <div className="px-2.5 pb-1 pt-2 text-micro font-bold uppercase tracking-wider text-faint">{heading}</div>}
                    <button onMouseEnter={() => setIdx(i)} onClick={() => pick(r)}
                      className={cx('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition',
                        i === idx ? 'bg-accent-soft/70' : 'hover:bg-slateSoft')}>
                      {r.icon && <Icon name={r.icon} size={16} className={i === idx ? 'text-accent' : 'text-faint'} />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-medium text-ink">{r.label}</span>
                        {r.sub && <span className="block truncate text-micro text-muted">{r.sub}</span>}
                      </span>
                      {r.hint && <span className="tnum shrink-0 text-meta text-muted">{r.hint}</span>}
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center gap-3 border-t border-line2 bg-bgtint/50 px-3.5 py-2 text-micro text-faint">
              <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
              <span className="flex items-center gap-1"><Kbd>Enter</Kbd> open</span>
              <span className="ml-auto flex items-center gap-1"><Kbd>Ctrl K</Kbd> toggle</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
