export type PaletteItem = { id: string; group?: string; icon?: string; label: string; sub?: string; hint?: string; onSelect?: () => void }
export default function CommandPalette(p: {
  search: (q: string) => PaletteItem[]; placeholder?: string; open?: boolean; onOpenChange?: (open: boolean) => void
}): JSX.Element
