import { create } from 'zustand'
import type { SidebarSection } from '../types'

const SIDEBAR_WIDTH_KEY = 'sc-sidebar-width'
const INSPECTOR_WIDTH_KEY = 'sc-inspector-width'

function loadWidth(key: string, defaultVal: number): number {
  try {
    const v = localStorage.getItem(key)
    return v ? parseInt(v, 10) : defaultVal
  } catch {
    return defaultVal
  }
}

interface UIState {
  activeSection: SidebarSection
  activeDocumentId: string | null
  activeEntityId: string | null
  inspectorOpen: boolean
  searchOpen: boolean
  searchQuery: string
  sidebarWidth: number
  inspectorWidth: number
  translationId: string | null
  pinnedEntityId: string | null

  setActiveSection: (section: SidebarSection) => void
  setActiveDocument: (id: string | null) => void
  setActiveEntity: (id: string | null) => void
  toggleInspector: () => void
  setInspectorOpen: (open: boolean) => void
  openSearch: () => void
  closeSearch: () => void
  setSearchQuery: (query: string) => void
  setSidebarWidth: (w: number) => void
  setInspectorWidth: (w: number) => void
  setTranslationId: (id: string | null) => void
  setPinnedEntity: (id: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  activeSection: 'manuscript',
  activeDocumentId: null,
  activeEntityId: null,
  inspectorOpen: true,
  searchOpen: false,
  searchQuery: '',
  sidebarWidth: loadWidth(SIDEBAR_WIDTH_KEY, 260),
  inspectorWidth: loadWidth(INSPECTOR_WIDTH_KEY, 320),
  translationId: null,
  pinnedEntityId: null,

  setActiveSection: (section) => set({ activeSection: section }),
  setActiveDocument: (id) => set({ activeDocumentId: id }),
  setActiveEntity: (id) => set({ activeEntityId: id }),
  toggleInspector: () => set(state => ({ inspectorOpen: !state.inspectorOpen })),
  setInspectorOpen: (open) => set({ inspectorOpen: open }),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSidebarWidth: (w) => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w))
    set({ sidebarWidth: w })
  },
  setInspectorWidth: (w) => {
    localStorage.setItem(INSPECTOR_WIDTH_KEY, String(w))
    set({ inspectorWidth: w })
  },
  setTranslationId: (id) => set({ translationId: id }),
  setPinnedEntity: (id) => set({ pinnedEntityId: id })
}))
