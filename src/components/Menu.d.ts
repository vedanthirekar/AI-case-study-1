import type { ReactNode } from 'react'
export default function Menu(p: {
  trigger: (open: boolean, toggle: () => void) => ReactNode
  children: ReactNode | ((close: () => void) => ReactNode)
  align?: 'left' | 'right'; side?: 'top' | 'bottom'; width?: number; className?: string
}): JSX.Element
export function MenuItem(p: {
  icon?: string; children?: ReactNode; onClick?: () => void; danger?: boolean
  disabled?: boolean; reason?: ReactNode; hint?: ReactNode
}): JSX.Element
export function MenuDivider(): JSX.Element
export function MenuLabel(p: { children?: ReactNode }): JSX.Element
