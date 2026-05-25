import { create } from 'zustand'
import type { ProjectMetadata, Document, Volume, Entity, Asset, LanguageConfig, Translation } from '../types'

interface ProjectState {
  projectPath: string | null
  config: ProjectMetadata | null
  documents: Document[]
  volumes: Volume[]
  entities: Entity[]
  assets: Asset[]
  languageConfig: LanguageConfig
  translations: Translation[]
  isLoading: boolean

  setProject: (path: string, config: ProjectMetadata) => void
  clearProject: () => void
  setDocuments: (docs: Document[]) => void
  setVolumes: (vols: Volume[]) => void
  setEntities: (entities: Entity[]) => void
  setAssets: (assets: Asset[]) => void
  setLanguageConfig: (config: LanguageConfig) => void
  setTranslations: (translations: Translation[]) => void
  upsertDocument: (doc: Document) => void
  removeDocument: (id: string) => void
  upsertVolume: (vol: Volume) => void
  removeVolume: (id: string) => void
  upsertEntity: (entity: Entity) => void
  removeEntity: (id: string) => void
  upsertTranslation: (t: Translation) => void
  removeTranslation: (id: string) => void
  setLoading: (loading: boolean) => void

  loadProject: (path: string, config: ProjectMetadata) => Promise<void>
  refreshDocuments: () => Promise<void>
  refreshVolumes: () => Promise<void>
  refreshEntities: () => Promise<void>
  refreshAssets: () => Promise<void>
  refreshTranslations: () => Promise<void>
  refreshLanguageConfig: () => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectPath: null,
  config: null,
  documents: [],
  volumes: [],
  entities: [],
  assets: [],
  languageConfig: { languages: [], defaultLanguage: '' },
  translations: [],
  isLoading: false,

  setProject: (path, config) => set({ projectPath: path, config }),
  clearProject: () => set({ projectPath: null, config: null, documents: [], volumes: [], entities: [], assets: [], translations: [], languageConfig: { languages: [], defaultLanguage: '' } }),
  setDocuments: (docs) => set({ documents: docs }),
  setVolumes: (vols) => set({ volumes: vols }),
  setEntities: (entities) => set({ entities }),
  setAssets: (assets) => set({ assets }),
  setLanguageConfig: (languageConfig) => set({ languageConfig }),
  setTranslations: (translations) => set({ translations }),

  upsertDocument: (doc) => set(state => {
    const idx = state.documents.findIndex(d => d.id === doc.id)
    if (idx >= 0) {
      const docs = [...state.documents]
      docs[idx] = doc
      return { documents: docs }
    }
    return { documents: [...state.documents, doc] }
  }),

  removeDocument: (id) => set(state => ({ documents: state.documents.filter(d => d.id !== id) })),

  upsertVolume: (vol) => set(state => {
    const idx = state.volumes.findIndex(v => v.id === vol.id)
    if (idx >= 0) {
      const vols = [...state.volumes]
      vols[idx] = vol
      return { volumes: vols }
    }
    return { volumes: [...state.volumes, vol] }
  }),

  removeVolume: (id) => set(state => ({ volumes: state.volumes.filter(v => v.id !== id) })),

  upsertEntity: (entity) => set(state => {
    const idx = state.entities.findIndex(e => e.id === entity.id)
    if (idx >= 0) {
      const entities = [...state.entities]
      entities[idx] = entity
      return { entities }
    }
    return { entities: [...state.entities, entity] }
  }),

  removeEntity: (id) => set(state => ({ entities: state.entities.filter(e => e.id !== id) })),

  upsertTranslation: (t) => set(state => {
    const idx = state.translations.findIndex(x => x.id === t.id)
    if (idx >= 0) {
      const translations = [...state.translations]
      translations[idx] = t
      return { translations }
    }
    return { translations: [...state.translations, t] }
  }),

  removeTranslation: (id) => set(state => ({ translations: state.translations.filter(t => t.id !== id) })),

  setLoading: (isLoading) => set({ isLoading }),

  loadProject: async (path, config) => {
    set({ projectPath: path, config, isLoading: true })
    await Promise.all([
      get().refreshDocuments(),
      get().refreshVolumes(),
      get().refreshEntities(),
      get().refreshAssets(),
      get().refreshTranslations(),
      get().refreshLanguageConfig()
    ])
    set({ isLoading: false })
  },

  refreshDocuments: async () => {
    const docs = await window.api.doc.list()
    set({ documents: docs })
  },

  refreshVolumes: async () => {
    const vols = await window.api.vol.list()
    set({ volumes: vols })
  },

  refreshEntities: async () => {
    const entities = await window.api.entity.list()
    set({ entities })
  },

  refreshAssets: async () => {
    const assets = await window.api.asset.list()
    set({ assets })
  },

  refreshTranslations: async () => {
    const translations = await window.api.translation.list()
    set({ translations })
  },

  refreshLanguageConfig: async () => {
    const config = await window.api.project.getLanguages()
    set({ languageConfig: config || { languages: [], defaultLanguage: '' } })
  }
}))
