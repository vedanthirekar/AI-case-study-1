// Loads the packet exactly as delivered (public/okafor_lindqvist_2025_packet.json).
// One fetch per session; the app store builds the model from it.
import type { Packet } from './types'

export const PACKET_URL = '/okafor_lindqvist_2025_packet.json'

let cache: Promise<Packet> | null = null

export function loadPacket(): Promise<Packet> {
  cache ??= fetch(PACKET_URL).then((r) => {
    if (!r.ok) throw new Error(`The packet failed to load (${r.status}).`)
    return r.json() as Promise<Packet>
  })
  return cache
}
