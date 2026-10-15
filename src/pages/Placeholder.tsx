// Stand-in for screens not built yet, so every nav item works from the first deploy.
import { useEffect } from 'react'
import { useShell } from '../components/shell/ShellContext'
import { Card, EmptyState } from '../components/ui'

export default function Placeholder({ title, body }: { title: string; body: string }) {
  const { publish } = useShell()
  useEffect(() => { publish({ crumbs: [{ label: title }] }) }, [publish, title])
  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <Card><EmptyState icon="compass" title={title} body={body} /></Card>
    </div>
  )
}
