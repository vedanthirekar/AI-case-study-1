// Toasts - NEW, the previous project had none. Styled to match: an inverse chip,
// like the tooltips, bottom-center, with an optional action (e.g. Undo).
//
//   // once, near the root:
//   <ToastProvider><App /></ToastProvider>
//   // anywhere:
//   const toast = useToast()
//   toast({ title: '12 lines verified', tone: 'good', action: { label: 'Undo', onClick: undo } })
import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from './ui'

const ToastCtx = createContext(null)
const ICON = { default: 'check', good: 'check', warn: 'alert', danger: 'alert' }
const DOT = { default: 'text-inverse-fg', good: 'text-good-soft', warn: 'text-warn-soft', danger: 'text-danger-soft' }

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const seq = useRef(0)

  const dismiss = useCallback((id) => setItems((xs) => xs.filter((x) => x.id !== id)), [])

  // An action toast stays longer: someone has to have time to reach Undo.
  const toast = useCallback(({ title, body, tone = 'default', action, duration }) => {
    seq.current += 1
    const id = seq.current
    setItems((xs) => [...xs.slice(-2), { id, title, body, tone, action }])
    setTimeout(() => dismiss(id), duration ?? (action ? 8000 : 4000))
    return id
  }, [dismiss])

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex flex-col items-center gap-2 px-4">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div key={t.id} layout
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.16 }}
              className="pointer-events-auto flex w-max max-w-[min(92vw,460px)] items-start gap-2.5 rounded-lg bg-inverse px-3.5 py-2.5 text-inverse-fg shadow-e3">
              <Icon name={ICON[t.tone] || ICON.default} size={15} className={`mt-0.5 shrink-0 ${DOT[t.tone] || DOT.default}`} />
              <div className="min-w-0 flex-1">
                <div className="text-body font-semibold">{t.title}</div>
                {t.body && <div className="mt-0.5 text-meta opacity-80">{t.body}</div>}
              </div>
              {t.action && (
                <button onClick={() => { t.action.onClick?.(); dismiss(t.id) }}
                  className="shrink-0 rounded-sm px-1.5 text-body font-semibold text-accent-soft underline-offset-2 hover:underline">
                  {t.action.label}
                </button>
              )}
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="shrink-0 opacity-60 transition hover:opacity-100">
                <Icon name="x" size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
