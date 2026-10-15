// Centered dialog for confirmations and short forms.
// Extracted from the previous project's confirmation dialog: same scrim, scale-in,
// width and title row. Closes on scrim click and Escape.
//
//   <Modal open={x} onClose={...} title="Grant sign-off?" tone="warn" icon="alert"
//     actions={<><Btn variant="ghost">Cancel</Btn><Btn variant="primary">Grant</Btn></>}>
//     Body text
//   </Modal>
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon, cx } from './ui'

const TONE = { default: 'text-ink', warn: 'text-warn', danger: 'text-danger', good: 'text-good', accent: 'text-accent' }

export default function Modal({ open, onClose, title, icon, tone = 'default', width = 420, actions, children }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  // Portalled to <body> so page layout can't shift it (see Drawer).
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
          className="fixed inset-0 z-50 grid place-items-center bg-scrim/50 p-4" onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            onClick={(e) => e.stopPropagation()}
            style={{ width: `min(94vw, ${width}px)` }}
            className="rounded-xl3 border border-line bg-surface p-5 shadow-e3">
            {title && (
              <div className={cx('flex items-center gap-2', TONE[tone] || TONE.default)}>
                {icon && <Icon name={icon} size={18} />}
                <span className="font-display text-lead font-bold">{title}</span>
              </div>
            )}
            <div className="mt-2 text-body leading-relaxed text-muted">{children}</div>
            {actions && <div className="mt-4 flex justify-end gap-2">{actions}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
