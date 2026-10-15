// Routes and navigation for the workpaper. Screens not built yet render a
// placeholder so every link works from the first deploy.
import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/shell/AppShell'
import KitGallery from './KitGallery'
import Overview from './pages/Overview'
import Placeholder from './pages/Placeholder'

const NAV = [
  { to: '/', label: 'Overview', icon: 'home', end: true },
  { to: '/review', label: 'Review inbox', icon: 'alert' },
  { to: '/return', label: 'Return', icon: 'grid' },
  { to: '/documents', label: 'Documents', icon: 'folder' },
  { to: '/areas', label: 'Areas', icon: 'book' },
  { to: '/changes', label: 'Changes', icon: 'history' },
  { to: '/filing', label: 'Filing', icon: 'send' },
]

const SECONDARY = [
  { to: '/firm', label: 'Firm', icon: 'shield' },
  { to: '/kit', label: 'Component kit', icon: 'columns' },
]

const SOON: Record<string, [string, string]> = {
  review: ['Review inbox', 'Findings from independent checks, ranked by tax effect.'],
  return: ['Return', 'Every line of the return, each traceable to its source.'],
  documents: ['Documents', 'All 74 documents and where each one landed.'],
  areas: ['Areas', 'Sales, depreciation, books to tax, rentals, K-1s, state split and more.'],
  changes: ['Changes', 'Version compare, activity since you last looked, and what-ifs.'],
  filing: ['Filing', 'Gates, extension, e-file, freeze and amend, notices, rollforward.'],
  firm: ['Firm', 'Standards, access log, time against budget.'],
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell brand={{ mark: 'M', name: 'Workpaper' }} nav={NAV} secondaryNav={SECONDARY} />}>
        <Route path="/" element={<Overview />} />
        {Object.entries(SOON).map(([path, [title, body]]) => (
          <Route key={path} path={`/${path}`} element={<Placeholder title={title} body={body} />} />
        ))}
        <Route path="/kit" element={<KitGallery />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
