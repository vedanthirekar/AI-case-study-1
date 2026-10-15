// The trace selection lives in the URL (?trace=F1040.11), so a traced number
// can be linked, shared and survives reload.
import { useSearchParams } from 'react-router-dom'
import { useCallback } from 'react'

export function useTrace() {
  const [params, setParams] = useSearchParams()
  const key = params.get('trace')
  const open = useCallback((k: string) => {
    setParams((p) => { const n = new URLSearchParams(p); n.set('trace', k); n.delete('ev'); return n })
  }, [setParams])
  const close = useCallback(() => {
    setParams((p) => { const n = new URLSearchParams(p); n.delete('trace'); n.delete('ev'); return n })
  }, [setParams])
  return { key, open, close }
}
