// Routes and navigation. The app waits for the packet and the workpaper log,
// then every screen reads from the same model and projection. Clients see only
// their portal (DESIGN rule 8: whole areas that belong to another job may be hidden).
import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/shell/AppShell'
import KitGallery from './KitGallery'
import { EmptyState, SkeletonRows } from './components/ui'
import { useApp, useActor } from './state/app'
import Overview from './pages/Overview'
import ReviewPage from './pages/ReviewPage'
import ReturnPage from './pages/ReturnPage'
import DocumentsPage from './pages/DocumentsPage'
import AreasPage from './pages/AreasPage'
import ChangesPage from './pages/ChangesPage'
import FilingPage, { ClientPortal, ClientCopy, NoticeResponse, NextYear } from './pages/FilingPage'
import FirmPage from './pages/FirmPage'
import { RoleSwitcher, SeasonClock, GlobalSearch, DemoMenu } from './features/shell/TopBar'
import { NotificationBell } from './features/shell/Notifications'
import { useFindings } from './features/findings'

export default function App() {
  const status = useApp((s) => s.status)
  const error = useApp((s) => s.error)
  const init = useApp((s) => s.init)
  useEffect(() => { void init() }, [init])

  if (status === 'error') return <div className="grid h-full place-items-center"><EmptyState icon="alert" title="The workpaper could not load" body={error} /></div>
  if (status === 'loading') return <div className="mx-auto max-w-3xl px-6 py-16"><div className="mb-4 font-display text-title">Loading the packet...</div><SkeletonRows rows={5} /></div>
  return <Ready />
}

function Ready() {
  const me = useActor()
  const open = useFindings().filter((f) => f.status === 'open').length
  const client = me.role === 'client'
  const tools = <>{!client && <GlobalSearch />}<SeasonClock /><NotificationBell /><RoleSwitcher /><DemoMenu /></>

  if (client) {
    return (
      <Routes>
        <Route element={<AppShell brand={{ mark: 'M', name: 'Miraflores' }} nav={[{ to: '/client', label: 'My 2025 return', icon: 'home' }, { to: '/filing/client-copy', label: 'My copy', icon: 'doc' }]} topRight={tools} />}>
          <Route path="/client" element={<ClientPortal />} />
          <Route path="/filing/client-copy" element={<ClientCopy />} />
          <Route path="*" element={<Navigate to="/client" replace />} />
        </Route>
      </Routes>
    )
  }

  const nav = [
    { to: '/', label: 'Overview', icon: 'home', end: true },
    { to: '/review', label: 'Review inbox', icon: 'alert', count: open },
    { to: '/return', label: 'Return', icon: 'grid' },
    { to: '/documents', label: 'Documents', icon: 'folder' },
    { to: '/areas', label: 'Areas', icon: 'book' },
    { to: '/changes', label: 'Changes', icon: 'history' },
    { to: '/filing', label: 'Filing', icon: 'send' },
  ]
  const secondary = [
    { to: '/firm', label: 'Firm', icon: 'shield' },
    { to: '/kit', label: 'Component kit', icon: 'columns' },
  ]
  return (
    <Routes>
      <Route element={<AppShell brand={{ mark: 'M', name: 'Workpaper' }} nav={nav} secondaryNav={secondary} topRight={tools} />}>
        <Route path="/" element={<Overview />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/return" element={<ReturnPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/:id" element={<DocumentsPage />} />
        <Route path="/areas" element={<AreasPage />} />
        <Route path="/changes" element={<ChangesPage />} />
        <Route path="/filing" element={<FilingPage />} />
        <Route path="/filing/client-copy" element={<ClientCopy />} />
        <Route path="/filing/notice/:id" element={<NoticeResponse />} />
        <Route path="/filing/next-year" element={<NextYear />} />
        <Route path="/firm" element={<FirmPage />} />
        <Route path="/client" element={<Navigate to="/" replace />} />
        <Route path="/kit" element={<KitGallery />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
