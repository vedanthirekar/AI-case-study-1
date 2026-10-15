// The frame every screen lives in: left rail, one slim top bar (breadcrumbs on
// the left, tools on the right), the page, and an optional right rail a page can
// fill via useShell().publish({ rail }). Extracted from the previous project's
// shell with its help drawer, tour, assistant and notification wiring removed.
//
//   <Route element={<AppShell nav={NAV} topRight={<RoleSwitcher />} sidebarFooter={...} />}>
//     ...pages...
//   </Route>
import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../ui'
import { useShell } from './ShellContext'
import Sidebar from './Sidebar'

export default function AppShell({ brand, nav = [], secondaryNav = [], sidebarBadge, sidebarFooter, topRight, railWidth = 288 }) {
  const { crumbs, rail } = useShell()
  const loc = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-full overflow-x-hidden">
      <Sidebar brand={brand} items={nav} secondary={secondaryNav} badge={sidebarBadge} footer={sidebarFooter}
        collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="glass relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface/85 px-5">
          <Breadcrumbs crumbs={crumbs} />
          <div className="ml-auto flex items-center gap-1.5">{topRight}</div>
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="pane min-w-0 flex-1 overflow-auto">
            <AnimatePresence mode="wait">
              {/* exit is instant: with mode="wait" any exit duration shows as a blank frame between routes */}
              <motion.div key={loc.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0 } }} transition={{ duration: 0.16 }} className="h-full">
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
          {rail && (
            <aside style={{ width: railWidth }} className="pane hidden shrink-0 overflow-auto border-l border-line bg-bgtint/40 p-4 xl:block">
              {rail}
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}

export function Breadcrumbs({ crumbs }) {
  if (!crumbs?.length) return <div className="text-body text-faint">-</div>
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-body">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1
        return (
          <span key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <Icon name="chevron" size={12} className="shrink-0 text-faint" />}
            {last || !c.to
              ? <span className="truncate font-semibold text-ink">{c.label}</span>
              : <Link to={c.to} className="truncate text-muted transition hover:text-accent">{c.label}</Link>}
          </span>
        )
      })}
    </nav>
  )
}

// Square icon button for the top bar, same as the previous project's bell and help buttons.
export function TopBarButton({ icon, label, onClick, count }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className="relative grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-slateSoft hover:text-ink">
      <Icon name={icon} size={19} />
      {count > 0 && (
        <span className="tnum absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger-fill px-1 text-micro font-bold text-white">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}
