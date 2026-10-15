// Types for ui.jsx (the kit stays plain JS; TypeScript reads this file instead).
import type { ReactNode, ButtonHTMLAttributes, HTMLAttributes } from 'react'

export type Tone = 'good' | 'warn' | 'danger' | 'accent' | 'ai' | 'muted'

export function cx(...a: unknown[]): string
export function Money(p: { value: number | null | undefined; className?: string; signed?: boolean }): JSX.Element
export function Avatar(p: { user?: { initials?: string; tint?: string }; size?: number; ring?: boolean }): JSX.Element
export function Tag(p: { tone?: Tone; children?: ReactNode; className?: string; dot?: boolean }): JSX.Element
export function Card(p: HTMLAttributes<HTMLDivElement> & { hover?: boolean; accent?: string }): JSX.Element
export function Btn(p: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'brand' | 'default' | 'warn' | 'good' | 'ghost' | 'danger' | 'dark'
  size?: 'sm' | 'md' | 'lg'
}): JSX.Element
export function Tooltip(p: { label?: ReactNode; children?: ReactNode; side?: 'top' | 'bottom' | 'bottom-end' | 'right'; className?: string }): JSX.Element
export function InfoTip(p: { label: string; side?: 'top' | 'bottom' | 'bottom-end' | 'right'; className?: string }): JSX.Element
export function Kbd(p: { children?: ReactNode }): JSX.Element
export function Skeleton(p: { className?: string; rounded?: string }): JSX.Element
export function SkeletonRows(p: { rows?: number; className?: string }): JSX.Element
export function EmptyState(p: { icon?: string; title: ReactNode; body?: ReactNode; action?: ReactNode }): JSX.Element
export function Icon(p: { name: string; size?: number; className?: string }): JSX.Element
