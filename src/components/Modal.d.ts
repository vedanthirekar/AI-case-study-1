import type { ReactNode } from 'react'
export default function Modal(p: {
  open: boolean; onClose: () => void; title?: ReactNode; icon?: string
  tone?: 'default' | 'warn' | 'danger' | 'good' | 'accent'; width?: number; actions?: ReactNode; children?: ReactNode
}): JSX.Element
