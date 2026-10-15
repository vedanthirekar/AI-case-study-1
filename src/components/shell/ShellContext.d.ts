import type { ReactNode } from 'react'
import type { Crumb } from '../kit-types'
export function ShellProvider(p: { children?: ReactNode }): JSX.Element
export function useShell(): { crumbs: Crumb[]; rail: ReactNode; publish: (p: { crumbs?: Crumb[]; rail?: ReactNode }) => void }
