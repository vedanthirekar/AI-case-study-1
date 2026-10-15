import type { ReactNode } from 'react'
export default function Drawer(p: {
  open: boolean; onClose: () => void; title?: ReactNode; icon?: string; width?: number
  footer?: ReactNode; children?: ReactNode; className?: string
}): JSX.Element
