// Persistent left rail: brand, primary nav, secondary nav, a footer slot (put the
// role switcher there), and a collapse handle. Extracted from the previous
// project's sidebar with the login, roles and tour wiring removed; the app passes
// its nav in.
//
// items: [{ to, label, icon, locked?, lockReason?, end? }]
// A locked item stays visible with a lock icon and a tooltip saying why.
import { NavLink, Link } from 'react-router-dom'
import { Icon, Tooltip, cx } from '../ui'

export default function Sidebar({ brand = { mark: 'W', name: 'Workpaper' }, items = [], secondary = [], badge, footer, collapsed, onToggle }) {
  return (
    <aside className={cx('relative z-30 flex shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200',
      collapsed ? 'w-[68px]' : 'w-[236px]')}>
      <Link to="/" title="Home" aria-label={`${brand.name} - home`}
        className={cx('flex h-14 shrink-0 items-center border-b border-line transition hover:bg-slateSoft',
          collapsed ? 'justify-center px-2' : 'gap-2.5 px-4')}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl2 bg-brand font-display text-title font-extrabold text-white">{brand.mark}</span>
        {!collapsed && <span className="font-display text-title font-bold tracking-tight">{brand.name}</span>}
      </Link>

      {/* optional context chip under the brand, e.g. the client or the active role */}
      {badge && !collapsed && <div className="px-3 pt-3">{badge}</div>}

      <nav className={cx('flex-1 space-y-0.5 overflow-y-auto py-3', collapsed ? 'px-2' : 'px-3')}>
        {items.map((n) => <NavItem key={n.to} item={n} collapsed={collapsed} />)}
        {secondary.length > 0 && <div className="!my-3 mx-1 h-px bg-line2" />}
        {secondary.map((n) => <NavItem key={n.to} item={n} collapsed={collapsed} />)}
      </nav>

      {footer && <div className="shrink-0 border-t border-line p-2">{typeof footer === 'function' ? footer(collapsed) : footer}</div>}

      <button onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'}
        className="flex h-9 shrink-0 items-center justify-center gap-1.5 border-t border-line text-micro font-semibold text-faint transition hover:bg-slateSoft hover:text-ink">
        <Icon name={collapsed ? 'chevron' : 'chevron-left'} size={14} />
        {!collapsed && 'Collapse'}
      </button>
    </aside>
  )
}

function NavItem({ item, collapsed }) {
  const body = (
    <span className={cx('flex items-center rounded-lg text-body font-medium transition',
      collapsed ? 'h-9 w-full justify-center' : 'gap-2.5 px-3 py-2',
      item.locked && 'cursor-not-allowed text-faint')}>
      <Icon name={item.locked ? 'lock' : item.icon} size={16} />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && item.count > 0 && <span className="tnum text-micro font-semibold text-faint">{item.count}</span>}
    </span>
  )

  if (item.locked) {
    return (
      <div className="cursor-not-allowed opacity-70">
        <Tooltip label={item.lockReason} side={collapsed ? 'right' : 'top'} className="w-full">
          <span className="block w-full">{body}</span>
        </Tooltip>
      </div>
    )
  }

  // Active state is a printed rule down the edge, not a filled pill.
  const link = (
    <NavLink to={item.to} end={item.end}
      className={({ isActive }) => cx('block w-full rounded-sm transition',
        isActive
          ? 'bg-accent-soft/70 text-accent shadow-[inset_2px_0_0_rgb(var(--c-accent))] [&_span]:text-accent'
          : 'text-muted hover:bg-slateSoft hover:text-ink')}>
      {body}
    </NavLink>
  )
  return collapsed
    ? <div><Tooltip label={item.label} side="right" className="w-full">{link}</Tooltip></div>
    : link
}
