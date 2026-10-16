// Keep a graph fitted when its canvas changes size (e.g. the trace panel opens beside it).
import { useEffect } from 'react'
import { useReactFlow, useStore } from '@xyflow/react'

export default function FitOnResize({ padding = 0.12, maxZoom = 1.1 }: { padding?: number; maxZoom?: number }) {
  const { fitView } = useReactFlow()
  const w = useStore((s) => s.width)
  const h = useStore((s) => s.height)
  const n = useStore((s) => s.nodeLookup.size)
  useEffect(() => {
    if (!w || !h) return // mid-layout: a zero-size canvas would fit to nothing
    const t = setTimeout(() => { void fitView({ padding, maxZoom, duration: 200 }) }, 30)
    return () => clearTimeout(t)
  }, [w, h, n, fitView, padding, maxZoom])
  return null
}
