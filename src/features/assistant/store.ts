// Whether the assistant panel is open, and a question another screen wants asked.
import { create } from 'zustand'

interface AssistantState {
  open: boolean
  pending: string | null
  toggle: () => void
  close: () => void
  /** Open the panel and ask this question. */
  ask: (q: string) => void
  take: () => string | null
}

export const useAssistant = create<AssistantState>((set, get) => ({
  open: false,
  pending: null,
  toggle: () => set({ open: !get().open }),
  close: () => set({ open: false }),
  ask: (q) => set({ open: true, pending: q }),
  take: () => { const q = get().pending; if (q) set({ pending: null }); return q },
}))
