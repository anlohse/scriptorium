import { create } from 'zustand'

interface EditorState {
  content: string
  isDirty: boolean
  isSaving: boolean
  wordCount: number
  lastSaved: Date | null

  setContent: (content: string) => void
  markDirty: () => void
  markClean: () => void
  setSaving: (saving: boolean) => void
  setWordCount: (count: number) => void
  setLastSaved: (date: Date) => void
  reset: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  content: '',
  isDirty: false,
  isSaving: false,
  wordCount: 0,
  lastSaved: null,

  setContent: (content) => set({ content }),
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),
  setSaving: (isSaving) => set({ isSaving }),
  setWordCount: (wordCount) => set({ wordCount }),
  setLastSaved: (lastSaved) => set({ lastSaved }),
  reset: () => set({ content: '', isDirty: false, isSaving: false, wordCount: 0, lastSaved: null })
}))
