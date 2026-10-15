// Dropdown menu / popover anchored to a trigger.
// Extracted from the previous project's account menu and activity popover: same
// floating card, short fade-slide, outside-click close. Also closes on Escape.
//
//   <Menu align="right" trigger={(open, toggle) => <Btn onClick={toggle}>Actions</Btn>}>
//     {(close) => (<>
//       <MenuItem icon="check" onClick={() => { doIt(); close() }}>Verify</MenuItem>
//       <MenuDivider />
//       <MenuItem icon="x" danger disabled reason="Only a reviewer can do this">Reject</MenuItem>
//     </>)}
//   </Menu>
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon, Tooltip, cx } from './ui'

export default function Menu({ trigger, children, align = 'left', side = 'bottom', width = 240, className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const click = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const key = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', click)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key) }
  }, [open])

  const close = () => setOpen(false)
  const up = side === 'top'

  return (
    <div className={cx('relative inline-block', className)} ref={ref}>
      {trigger(open, () => setOpen((o) => !o))}
      <AnimatePresence>
        {open && (
          <motion.div role="menu"
            initial={{ opacity: 0, y: up ? 6 : -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: up ? 6 : -6 }}
            transition={{ duration: 0.14 }}
            style={{ width }}
            className={cx('absolute z-50 overflow-hidden rounded-xl2 border border-line bg-surface p-1.5 shadow-e3',
              up ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
              align === 'right' ? 'right-0' : 'left-0')}>
            {typeof children === 'function' ? children(close) : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// A disabled item stays visible and explains itself (communicate, don't hide).
export function MenuItem({ icon, children, onClick, danger = false, disabled = false, reason, hint }) {
  const item = (
    <button role="menuitem" onClick={disabled ? undefined : onClick} disabled={disabled}
      className={cx('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-body font-medium transition',
        disabled ? 'cursor-not-allowed text-faint'
          : danger ? 'text-danger hover:bg-danger-soft' : 'text-muted hover:bg-slateSoft hover:text-ink')}>
      {icon && <Icon name={disabled ? 'lock' : icon} size={15} />}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="tnum text-micro text-faint">{hint}</span>}
    </button>
  )
  return disabled && reason
    ? <Tooltip label={reason} side="right" className="w-full"><span className="block w-full">{item}</span></Tooltip>
    : item
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-line2" />
}

export function MenuLabel({ children }) {
  return <div className="px-2.5 pb-1 pt-1.5 text-micro font-bold uppercase tracking-wider text-faint">{children}</div>
}
