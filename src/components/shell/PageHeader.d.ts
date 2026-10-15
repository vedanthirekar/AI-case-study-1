import type { ReactNode } from 'react'
export default function PageHeader(p: {
  eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; icon?: string; actions?: ReactNode; className?: string
}): JSX.Element
