// Shared UI primitives. Dependency-free inline SVG icons.
// Colours come from the token layer in index.css: `-fill` tones sit behind white
// text, plain tones are used as text/borders, so everything themes for free.
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export const cx = (...a) => a.filter(Boolean).join(' ')

export function Money({ value, className = '', signed = false }) {
  if (value == null) return <span className={cx('text-faint', className)}>-</span>
  const neg = value < 0
  return (
    <span className={cx('tnum font-semibold', neg && 'text-danger', className)}>
      {neg ? '−' : signed ? '+' : ''}${Math.abs(value).toLocaleString('en-US')}
    </span>
  )
}

export function Avatar({ user, size = 28, ring = false }) {
  // The persona tint at full strength for the initials, at 12% behind them -
  // legible on the warm stock this direction prints on.
  const base = user?.tint || '#4f46e5'
  const fg = base
  const bg = base + '1f'
  return (
    <span
      className={cx('inline-grid shrink-0 place-items-center rounded-full font-display font-bold', ring && 'ring-2 ring-surface')}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.42 }}>
      {user?.initials || '??'}
    </span>
  )
}

// Print marks, not filled chips: a hairline outline in the tone's own ink. The
// status dot keeps carrying the colour, so meaning survives at a glance.
const TONES = {
  good: 'border-good/45 text-good', warn: 'border-warn/50 text-warn', danger: 'border-danger/45 text-danger',
  accent: 'border-accent/40 text-accent', ai: 'border-ai/40 text-ai', muted: 'border-line text-muted',
}
export function Tag({ tone = 'muted', children, className = '', dot = false }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border bg-transparent px-1.5 py-0.5 text-micro font-semibold', TONES[tone] || TONES.muted, className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  )
}

export function Card({ children, className = '', hover = false, accent, ...rest }) {
  // No lift on hover - nothing floats in this direction. The rule darkens instead.
  return (
    <div className={cx('relative rounded-xl2 border border-line bg-surface',
      hover && 'transition-colors hover:border-accent/50', className)} {...rest}>
      {accent && <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent }} />}
      {children}
    </div>
  )
}

export function Btn({ variant = 'default', size = 'md', className = '', children, ...rest }) {
  const styles = {
    primary: 'bg-accent-fill text-white border-transparent shadow-brand hover:brightness-110',
    brand: 'bg-brand text-white border-transparent shadow-brand hover:brightness-110',
    default: 'bg-surface text-ink border-line hover:bg-slateSoft',
    warn: 'bg-warn-fill text-white border-transparent hover:brightness-110',
    good: 'bg-good-fill text-white border-transparent hover:brightness-110',
    ghost: 'bg-transparent text-muted border-transparent hover:bg-slateSoft hover:text-ink',
    danger: 'bg-surface text-danger border-line hover:bg-danger-soft',
    dark: 'bg-inverse text-inverse-fg border-transparent hover:brightness-125',
  }
  const sizes = { sm: 'px-2.5 py-1 text-meta', md: 'px-3 py-1.5 text-body', lg: 'px-4 py-2 text-lead' }
  return (
    <button className={cx('inline-flex items-center justify-center gap-1.5 rounded-lg border font-semibold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100', styles[variant], sizes[size], className)} {...rest}>
      {children}
    </button>
  )
}

// `className` exists for one real case: an inline-flex wrapper shrink-wraps its
// child, so a full-width trigger (a collapsed nav item) needs to opt into
// filling its parent instead.
export function Tooltip({ label, children, side = 'top', className = '' }) {
  const [open, setOpen] = useState(false)
  const anchor = useRef(null)
  const tip = useRef(null)
  const [pos, setPos] = useState(null)
  // The tooltip renders on document.body with fixed coordinates, so a scrolling
  // panel never clips it, and it is clamped inside the window. `side` is the
  // preferred placement; it flips when there is no room.
  useLayoutEffect(() => {
    if (!open || !anchor.current || !tip.current) return
    const a = anchor.current.getBoundingClientRect()
    const t = tip.current.getBoundingClientRect()
    const gap = 6, pad = 8, vw = window.innerWidth, vh = window.innerHeight
    let x, y
    if (side === 'right') {
      x = a.right + gap; y = a.top + a.height / 2 - t.height / 2
      if (x + t.width > vw - pad) x = a.left - gap - t.width
    } else {
      const below = side === 'bottom' || side === 'bottom-end'
      x = side === 'bottom-end' ? a.right - t.width : a.left + a.width / 2 - t.width / 2
      y = below ? a.bottom + gap : a.top - gap - t.height
      if (!below && y < pad) y = a.bottom + gap
      if (below && y + t.height > vh - pad) y = a.top - gap - t.height
    }
    x = Math.min(Math.max(x, pad), vw - pad - t.width)
    y = Math.min(Math.max(y, pad), vh - pad - t.height)
    setPos({ x, y })
  }, [open, side, label])
  const show = () => { setPos(null); setOpen(true) }
  // A disabled control fires no mouse events, so its tooltip (rule 8: say which
  // role can, and why) would never open. Letting the pointer pass through
  // disabled children puts the hover on this wrapper instead. Focus opens it too.
  return (
    <span ref={anchor} className={cx('relative inline-flex [&_:disabled]:pointer-events-none', className)}
      onMouseEnter={show} onMouseLeave={() => setOpen(false)}
      onFocus={show} onBlur={() => setOpen(false)}>
      {children}
      {open && label && createPortal(
        <span ref={tip} role="tooltip" style={{ left: pos?.x ?? 0, top: pos?.y ?? 0, visibility: pos ? 'visible' : 'hidden' }}
          className="pointer-events-none fixed z-[100] w-max max-w-[240px] rounded-lg bg-inverse px-2.5 py-1.5 text-micro font-medium leading-snug text-inverse-fg shadow-e3">
          {label}
        </span>,
        document.body,
      )}
    </span>
  )
}

// A quiet ⓘ for the places where a taxpayer predictably gets stuck. Built on
// Tooltip rather than as a second mechanism, and used sparingly - a screen
// speckled with these is a screen whose labels aren't doing their job.
export function InfoTip({ label, side = 'top', className = '' }) {
  return (
    <Tooltip label={label} side={side}>
      <span tabIndex={0} role="note" aria-label={label}
        className={cx('inline-grid h-4 w-4 cursor-help place-items-center rounded-full border border-line text-[9px] font-bold leading-none text-muted transition hover:border-accent hover:text-accent focus:border-accent focus:text-accent focus:outline-none', className)}>
        i
      </span>
    </Tooltip>
  )
}

export function Kbd({ children }) {
  return <kbd className="rounded border border-line bg-slateSoft px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">{children}</kbd>
}

// ---- loading + empty states -------------------------------------------------

export function Skeleton({ className = '', rounded = 'rounded-lg' }) {
  return <div className={cx('shimmer bg-slateSoft', rounded, className)} />
}

export function SkeletonRows({ rows = 5, className = '' }) {
  return (
    <div className={cx('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl2 border border-line bg-surface px-4 py-3">
          <Skeleton className="h-9 w-9" rounded="rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16" rounded="rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ icon = 'compass', title, body, action }) {
  return (
    <div className="grid place-items-center px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Icon name={icon} size={22} />
      </span>
      <div className="mt-3 font-display text-lead font-semibold">{title}</div>
      {body && <p className="mt-1 max-w-sm text-body text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// Inline icon set.
export function Icon({ name, size = 16, className = '' }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', className }
  switch (name) {
    case 'grid': return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
    case 'folder': return <svg {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
    case 'doc': return <svg {...p}><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v5h5" /></svg>
    case 'chat': return <svg {...p}><path d="M4 5h16v11H8l-4 4z" /></svg>
    case 'home': return <svg {...p}><path d="M4 11 12 4l8 7" /><path d="M6 10v9h12v-9" /></svg>
    case 'search': return <svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
    case 'chevron': return <svg {...p}><path d="m9 6 6 6-6 6" /></svg>
    case 'chevron-down': return <svg {...p}><path d="m6 9 6 6 6-6" /></svg>
    case 'chevron-left': return <svg {...p}><path d="m15 6-6 6 6 6" /></svg>
    case 'chevron-up': return <svg {...p}><path d="m6 15 6-6 6 6" /></svg>
    case 'arrow-right': return <svg {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
    case 'check': return <svg {...p}><path d="m5 12 5 5 9-11" /></svg>
    case 'check-double': return <svg {...p}><path d="m2 13 4 4 8-10" /><path d="m12 16 1 1 8-10" /></svg>
    case 'lock': return <svg {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
    case 'unlock': return <svg {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 7.5-2" /></svg>
    case 'edit': return <svg {...p}><path d="M4 20h4l10-10-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>
    case 'sparkle': return <svg {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>
    case 'wand': return <svg {...p}><path d="m4 20 10-10" /><path d="M14 6l1-3 1 3 3 1-3 1-1 3-1-3-3-1z" /></svg>
    case 'alert': return <svg {...p}><path d="M12 3 2 20h20z" /><path d="M12 9v5" /><path d="M12 17h.01" /></svg>
    case 'link': return <svg {...p}><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></svg>
    case 'clock': return <svg {...p}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>
    case 'user': return <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg>
    case 'users': return <svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2 19c0-3.5 3.2-5.5 7-5.5s7 2 7 5.5" /><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6" /><path d="M18.5 19c0-2.6-1-4.3-2.5-5.2" /></svg>
    case 'filter': return <svg {...p}><path d="M3 5h18l-7 8v6l-4-2v-4z" /></svg>
    case 'back': return <svg {...p}><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></svg>
    case 'upload': return <svg {...p}><path d="M12 16V5" /><path d="m7 10 5-5 5 5" /><path d="M4 19h16" /></svg>
    case 'play': return <svg {...p}><path d="M7 5v14l12-7z" /></svg>
    case 'x': return <svg {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
    case 'plus': return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>
    case 'minus': return <svg {...p}><path d="M5 12h14" /></svg>
    case 'trending': return <svg {...p}><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>
    case 'compass': return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="m15 9-2 6-4 0 2-6z" /></svg>
    case 'route': return <svg {...p}><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8 16.5 16 7.5" /></svg>
    case 'scale': return <svg {...p}><path d="M12 4v16" /><path d="M7 8h10" /><path d="m5 8-2 5h4z" /><path d="m19 8-2 5h4z" /></svg>
    case 'keyboard': return <svg {...p}><rect x="3" y="7" width="18" height="11" rx="2" /><path d="M7 11h.01M11 11h.01M15 11h.01M7 14h10" /></svg>
    case 'bolt': return <svg {...p}><path d="M13 3 4 14h6l-1 7 9-11h-6z" /></svg>
    case 'shield': return <svg {...p}><path d="M12 3 5 6v5c0 4 3 7 7 9 4-2 7-5 7-9V6z" /></svg>
    case 'bell': return <svg {...p}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>
    case 'help': return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.6.2-.7.6-.7 1.1v.5" /><path d="M12 17h.01" /></svg>
    case 'book': return <svg {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M8 7h7M8 11h7" /></svg>
    case 'life-buoy': return <svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="m5.6 5.6 3.2 3.2M15.2 15.2l3.2 3.2M18.4 5.6l-3.2 3.2M8.8 15.2l-3.2 3.2" /></svg>
    case 'mail': return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></svg>
    case 'phone': return <svg {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" /></svg>
    case 'logout': return <svg {...p}><path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" /><path d="M10 16l-4-4 4-4" /><path d="M6 12h9" /></svg>
    case 'switch': return <svg {...p}><path d="M4 8h13l-3-3" /><path d="M20 16H7l3 3" /></svg>
    case 'columns': return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M12 4v16" /></svg>
    case 'panel': return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>
    case 'zoom-in': return <svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M11 8.5v5M8.5 11h5" /></svg>
    case 'zoom-out': return <svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M8.5 11h5" /></svg>
    case 'note': return <svg {...p}><path d="M5 4h14a1 1 0 0 1 1 1v10l-5 5H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" /><path d="M20 15h-5v5" /><path d="M8 9h8M8 13h4" /></svg>
    case 'pin': return <svg {...p}><path d="M12 17v5" /><path d="M8 3h8l-1 6 3 3H6l3-3z" /></svg>
    case 'eye': return <svg {...p}><path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="2.5" /></svg>
    case 'globe': return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" /></svg>
    case 'key': return <svg {...p}><circle cx="8" cy="14" r="4" /><path d="m11 11 9-9" /><path d="m17 4 2 2M14.5 6.5l2 2" /></svg>
    case 'history': return <svg {...p}><path d="M4 12a8 8 0 1 0 2.5-5.8L4 8.5" /><path d="M4 4v5h5" /><path d="M12 8v4.5l3 1.5" /></svg>
    case 'send': return <svg {...p}><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /><path d="M4 7v10" /></svg>
    case 'stop': return <svg {...p}><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
    case 'refresh': return <svg {...p}><path d="M20 12a8 8 0 1 1-2.5-5.8L20 8.5" /><path d="M20 4v5h-5" /></svg>
    default: return <svg {...p}><circle cx="12" cy="12" r="9" /></svg>
  }
}
