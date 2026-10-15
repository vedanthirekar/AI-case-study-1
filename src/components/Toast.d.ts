import type { ReactNode } from 'react'
export type ToastInput = {
  title: ReactNode; body?: ReactNode; tone?: 'default' | 'good' | 'warn' | 'danger'
  action?: { label: string; onClick: () => void }; duration?: number
}
export function ToastProvider(p: { children?: ReactNode }): JSX.Element
export function useToast(): (t: ToastInput) => number
