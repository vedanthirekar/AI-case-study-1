// Routes and navigation. The app waits for the packet and the workpaper log,
// then every screen reads from the same model and projection.
import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/shell/AppShell'
import KitGallery from './KitGallery'
import { EmptyState, SkeletonRows } from './components/ui'
import { useApp } from './state/app'
import Overview from './pages/Overview'
import ReviewPage from './pages/ReviewPage'
import ReturnPage from './pages/ReturnPage'
import DocumentsPage from './pages/DocumentsPage'
import Placeholder from './pages/Placeholder'
import { RoleSwitcher, SeasonClock, GlobalSearch, DemoMenu } from './features/shell/TopBar'
import { useFindings } from './features/findings'

const SOON: Record<string, [string, string]> = {
  areas: ['Areas', 'Sales detail, depreciation, books to tax, rentals, K-1s and basis, state split, payments, carryovers.'],
  changes: ['Changes', 'Version compare, activity since you last looked, and what-ifs.'],
  filing: ['Filing', 'Gates, extension, e-file, freeze and amend, notices, rollforward.'],
  firm: ['Firm', 'Standards, access log, time against budget.'],
}

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
  const open = useFindings().filter((f) => f.status === 'open').length
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
      <Route element={<AppShell brand={{ mark: 'M', name: 'Workpaper' }} nav={nav} secondaryNav={secondary}
        topRight={<><GlobalSearch /><SeasonClock /><RoleSwitcher /><DemoMenu /></>} />}>
        <Route path="/" element={<Overview />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/return" element={<ReturnPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/:id" element={<DocumentsPage />} />
        {Object.entries(SOON).map(([path, [title, body]]) => (
          <Route key={path} path={`/${path}`} element={<Placeholder title={title} body={body} />} />
        ))}
        <Route path="/kit" element={<KitGallery />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
