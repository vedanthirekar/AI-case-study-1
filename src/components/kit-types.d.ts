// Shared prop types for the kit components' .d.ts files.
import type { ReactNode } from 'react'

export type NavItem = { to: string; label: string; icon: string; end?: boolean; locked?: boolean; lockReason?: string; count?: number }
export type Crumb = { label: string; to?: string }
export type Children = { children?: ReactNode }
