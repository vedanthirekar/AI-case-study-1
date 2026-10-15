import type { ReactNode } from 'react'
import type { Tone } from './ui'
export type Vocab = Record<string, { label: string; short?: string; tone: Tone; icon?: string; desc?: string }>
export default function StatusBadge(p: { vocab: Vocab; value: string; withIcon?: boolean; suffix?: ReactNode; className?: string }): JSX.Element | null
export function StatusLegend(p: { vocab: Vocab; title?: ReactNode; columns?: 1 | 2 }): JSX.Element
