import type { ReactNode } from 'react'
import type { NavItem, Crumb } from '../kit-types'
export default function AppShell(p: {
  brand?: { mark: string; name: string }; nav?: NavItem[]; secondaryNav?: NavItem[]; sidebarBadge?: ReactNode
  sidebarFooter?: ReactNode | ((collapsed: boolean) => ReactNode); topRight?: ReactNode; railWidth?: number
}): JSX.Element
export function Breadcrumbs(p: { crumbs: Crumb[] }): JSX.Element
export function TopBarButton(p: { icon: string; label: string; onClick?: () => void; count?: number }): JSX.Element
