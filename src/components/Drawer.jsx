// Side panel that slides in from the right over a dimmed page.
// Extracted from the previous project's help drawer: same scrim, spring, width,
// header and border treatment. Closes on scrim click and Escape.
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon, cx } from './ui'

export default function Drawer({ open, onClose, title, icon, width = 400, footer, children, className = '' }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  // Portalled to <body>: a fixed overlay rendered inside a page would inherit
  // that page's layout (space-y margins, transformed ancestors) and shift.
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-40 bg-scrim/40" />
          <motion.aside role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
            initial={{ x: width }} animate={{ x: 0 }} exit={{ x: width }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            style={{ width: `min(92vw, ${width}px)` }}
            className={cx('fixed right-0 top-0 z-50 flex h-full flex-col overflow-hidden border-l border-line bg-surface shadow-e3', className)}>
            <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3">
              {icon && (
                <span className="grid h-7 w-7 place-items-center rounded-sm border border-accent/40 text-accent">
                  <Icon name={icon} size={15} />
                </span>
              )}
              <span className="min-w-0 truncate font-display text-body font-bold">{title}</span>
              <button onClick={onClose} aria-label="Close" className="ml-auto text-faint transition hover:text-ink">
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="pane min-h-0 flex-1 overflow-y-auto">{children}</div>
            {footer && <div className="shrink-0 border-t border-line bg-bgtint/50 px-4 py-3">{footer}</div>}
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
