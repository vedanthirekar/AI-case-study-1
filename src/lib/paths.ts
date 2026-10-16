// Every URL in one place. Client work lives under /clients/<id>/...; the firm's
// own pages (client list, settings) sit outside any client file.
import { areaOf } from './packet/areas'

let clientId = 'CL-20417'
export function setClientId(id: string) { clientId = id }
export function currentClientId() { return clientId }

/** A path inside the open client file. */
export const C = (p = '') => `/clients/${clientId}${p}`

/** Where a line's trace opens: its area in Schedules, with the trace panel. */
export const traceHref = (key: string) => C(`/schedules?area=${areaOf(key)}&trace=${encodeURIComponent(key)}`)

/** A number on the return map, zoomed into its lineage. */
export const lineageHref = (key: string) => C(`?focus=${encodeURIComponent(key)}&trace=${encodeURIComponent(key)}`)

export const docHref = (id: string, q = '') => C(`/documents/${id}${q}`)
export const reviewHref = (q = '') => C(`/review${q}`)
export const filingHref = (p = '') => C(`/filing${p}`)
export const schedulesHref = (q = '') => C(`/schedules${q}`)

export const FIRM = { clients: '/', settings: '/firm', portal: '/portal' }
