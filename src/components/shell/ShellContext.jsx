// Lets each page feed the shell: breadcrumbs for the top bar, and optional
// content for the right-hand rail. Pages call publish() in an effect; the shell
// renders it. Same mechanism the previous project used.
//
//   const { publish } = useShell()
//   useEffect(() => { publish({ crumbs: [{ label: 'Return', to: '/' }, { label: 'Wages' }], rail: <Related id={id} /> }) }, [id, publish])
import { createContext, useContext, useState, useCallback, useMemo } from 'react'

const ShellCtx = createContext(null)

export function ShellProvider({ children }) {
  const [crumbs, setCrumbs] = useState([])
  const [rail, setRail] = useState(null)

  // `rail` is cleared unless a page re-publishes it, so it never leaks onto the next screen.
  const publish = useCallback(({ crumbs, rail }) => {
    if (crumbs) setCrumbs(crumbs)
    setRail(rail ?? null)
  }, [])

  const value = useMemo(() => ({ crumbs, rail, publish }), [crumbs, rail, publish])
  return <ShellCtx.Provider value={value}>{children}</ShellCtx.Provider>
}

export function useShell() {
  const ctx = useContext(ShellCtx)
  if (!ctx) throw new Error('useShell must be used within ShellProvider')
  return ctx
}
