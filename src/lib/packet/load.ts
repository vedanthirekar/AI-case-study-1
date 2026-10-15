// Loads the packet exactly as delivered (public/okafor_lindqvist_2025_packet.json).
// One fetch per session; every screen reads from the same parsed object.
import { useEffect, useState } from 'react'

export const PACKET_URL = '/okafor_lindqvist_2025_packet.json'

// Typed loosely for now; the normalizer will add precise types per section.
export type Packet = {
  packet: { name: string; version: string; generated: string; client_id: string }
  documents: { id: string; title: string }[]
  extracted_values: { id: string }[]
  return_versions: {
    version: string
    computed_at: string
    trigger: string
    summary: {
      federal: { agi: number; taxable_income: number; total_tax: number; payments: number; balance_due: number; penalty: number }
      california: { total_agi: number; ca_agi: number; total_tax: number; payments: number; balance_due: number; penalty: number }
    }
    lines: unknown[]
  }[]
  [section: string]: unknown
}

let cache: Promise<Packet> | null = null

export function loadPacket(): Promise<Packet> {
  cache ??= fetch(PACKET_URL).then((r) => {
    if (!r.ok) throw new Error(`Packet failed to load (${r.status})`)
    return r.json() as Promise<Packet>
  })
  return cache
}

export function usePacket() {
  const [state, setState] = useState<{ packet: Packet | null; error: string | null }>({ packet: null, error: null })
  useEffect(() => {
    let live = true
    loadPacket().then(
      (packet) => live && setState({ packet, error: null }),
      (e: Error) => live && setState({ packet: null, error: e.message }),
    )
    return () => { live = false }
  }, [])
  return state
}
