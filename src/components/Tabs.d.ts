export type TabItem = { key: string; label: string; icon?: string; count?: number; countTone?: 'warn' | 'accent' }
export default function Tabs(p: {
  items: TabItem[]; value: string; onChange?: (key: string) => void; variant?: 'underline' | 'fill'; className?: string
}): JSX.Element
