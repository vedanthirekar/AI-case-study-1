// Routes and navigation. The firm sees its clients; opening one gives the client
// file: Return map, Review, Documents, Schedules, Filing. Clients see only their portal.
import { useEffect, useState, lazy, Suspense, type ReactNode } from 'react'
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import AppShell from './components/shell/AppShell'
import { EmptyState, Icon, SkeletonRows, cx } from './components/ui'
import { useApp, useActor } from './state/app'
import { C, FIRM } from './lib/paths'
import ClientsPage from './pages/ClientsPage'
import ReviewPage from './pages/ReviewPage'
import DocumentsPage from './pages/DocumentsPage'
import AreasPage from './pages/AreasPage'
import FilingPage, { ClientPortal, ClientCopy, NoticeResponse, NextYear } from './pages/FilingPage'
import FirmPage from './pages/FirmPage'
import { RoleSwitcher, SeasonClock, GlobalSearch, DemoMenu } from './features/shell/TopBar'
import { NotificationBell } from './features/shell/Notifications'
import { useFindings, isOpenIssue } from './features/findings'
import { useAssistant } from './features/assistant/store'

// The graph library is only downloaded when a client file is opened.
const MapPage = lazy(() => import('./pages/MapPage'))
// The assistant (and the AI SDK) loads the first time it is opened.
const AssistantPanel = lazy(() => import('./features/assistant/AssistantPanel'))
const Loading = () => <div className="p-6"><SkeletonRows rows={4} /></div>

export default function App() {
  const status = useApp((s) => s.status)
  const error = useApp((s) => s.error)
  const init = useApp((s) => s.init)
  useEffect(() => { void init() }, [init])

  if (status === 'error') return <div className="grid h-full place-items-center"><EmptyState icon="alert" title="The workpaper could not load" body={error} /></div>
  if (status === 'loading') return <div className="mx-auto max-w-3xl px-6 py-16"><div className="mb-4 font-display text-title">Loading the packet...</div><SkeletonRows rows={5} /></div>
  return <Ready />
}

/** Old links (before client files) still land in the right place, query and all. */
function Legacy({ to }: { to: string }) {
  const { search } = useLocation()
  const [path, q] = to.split('?')
  const merged = new URLSearchParams(q ?? '')
  new URLSearchParams(search).forEach((v, k) => merged.set(k, v))
  const s = merged.toString()
  return <Navigate to={`${path}${s ? `?${s}` : ''}`} replace />
}

function ClientBadge() {
  return (
    <div className="rounded-lg border border-line bg-bgtint/60 px-2.5 py-2">
      <Link to={FIRM.clients} className="flex items-center gap-1 text-micro font-semibold text-muted hover:text-accent"><Icon name="chevron-left" size={12} />All clients</Link>
      <div className="mt-1 text-meta font-semibold text-ink">Okafor-Lindqvist</div>
      <div className="text-micro text-muted">2025 · 1040 + CA 540NR</div>
    </div>
  )
}

function Ready() {
  const me = useActor()
  const loc = useLocation()
  const open = useFindings().filter(isOpenIssue).length
  const tools = <>{me.role !== 'client' && <GlobalSearch />}<AskButton /><SeasonClock /><NotificationBell /><RoleSwitcher /><DemoMenu /></>

  if (me.role === 'client') {
    return (
      <Routes>
        <Route element={<AppShell brand={{ mark: 'M', name: 'Miraflores' }} nav={[{ to: FIRM.portal, label: 'My 2025 return', icon: 'home', end: true }, { to: '/portal/copy', label: 'My copy', icon: 'doc' }]} topRight={tools} dock={<Dock key={me.id} />} />}>
          <Route path="/portal" element={<ClientPortal />} />
          <Route path="/portal/copy" element={<ClientCopy />} />
          <Route path="*" element={<Navigate to={FIRM.portal} replace />} />
        </Route>
      </Routes>
    )
  }

  const inClient = loc.pathname.startsWith('/clients/')
  const nav = inClient ? [
    { to: C(), label: 'Return map', icon: 'route', end: true },
    { to: C('/review'), label: 'Review', icon: 'alert', count: open },
    { to: C('/documents'), label: 'Documents', icon: 'folder' },
    { to: C('/schedules'), label: 'Schedules', icon: 'book' },
    { to: C('/filing'), label: 'Filing', icon: 'send' },
  ] : [
    { to: FIRM.clients, label: 'Clients', icon: 'users', end: true },
    { to: FIRM.settings, label: 'Firm settings', icon: 'shield' },
  ]
  const secondary = inClient
    ? [{ to: FIRM.clients, label: 'All clients', icon: 'users', end: true }, { to: FIRM.settings, label: 'Firm settings', icon: 'shield' }]
    : []
  const lazyPage = (el: ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>
  const legacy = (from: string, to: string) => <Route key={from} path={from} element={<Legacy to={to} />} />

  return (
    <Routes>
      <Route element={<AppShell brand={{ mark: 'M', name: 'Miraflores' }} nav={nav} secondaryNav={secondary} sidebarBadge={inClient ? <ClientBadge /> : undefined} topRight={tools} dock={<Dock key={me.id} />} />}>
        <Route path="/" element={<ClientsPage />} />
        <Route path="/firm" element={<FirmPage />} />
        <Route path="/clients/:cid">
          <Route index element={lazyPage(<MapPage />)} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="documents/:id" element={<DocumentsPage />} />
          <Route path="schedules" element={<AreasPage />} />
          <Route path="filing" element={<FilingPage />} />
          <Route path="filing/client-copy" element={<ClientCopy />} />
          <Route path="filing/notice/:id" element={<NoticeResponse />} />
          <Route path="filing/next-year" element={<NextYear />} />
        </Route>
        {[legacy('/review', C('/review')), legacy('/return', C('/schedules')), legacy('/areas', C('/schedules')), legacy('/documents', C('/documents')),
          legacy('/filing', C('/filing')), legacy('/changes', C('/review?tab=history')), legacy('/lineage', C()), legacy('/portal', FIRM.clients)]}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

/** The assistant's entry point: named and labelled, so people know it is there. */
function AskButton() {
  const toggle = useAssistant((s) => s.toggle)
  const open = useAssistant((s) => s.open)
  return (
    <button onClick={toggle} aria-pressed={open} title="Ask Mira, the AI assistant, about this client file"
      className={cx('flex h-9 items-center gap-2 rounded-lg border px-3 text-meta font-semibold transition',
        open ? 'border-ai bg-ai-fill text-white' : 'border-ai/40 bg-ai-soft text-ai hover:border-ai hover:bg-ai-soft/70')}>
      <Icon name="sparkle" size={18} />
      Ask Mira
      <span className={cx('rounded px-1 text-[10px] font-bold uppercase tracking-wider', open ? 'bg-white/20' : 'bg-ai/10')}>AI</span>
    </button>
  )
}

/** Mounted from the first open on, so the conversation survives closing the panel. */
function Dock() {
  const open = useAssistant((s) => s.open)
  const [loaded, setLoaded] = useState(open)
  useEffect(() => { if (open) setLoaded(true) }, [open])
  return loaded ? <Suspense fallback={null}><AssistantPanel /></Suspense> : null
}