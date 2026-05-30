import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Project
  project: {
    create: (name: string, parentDir: string) => ipcRenderer.invoke('project:create', name, parentDir),
    open: (projectPath: string) => ipcRenderer.invoke('project:open', projectPath),
    openDialog: () => ipcRenderer.invoke('project:openDialog'),
    createDialog: (name: string) => ipcRenderer.invoke('project:createDialog', name),
    close: () => ipcRenderer.invoke('project:close'),
    getCurrent: () => ipcRenderer.invoke('project:getCurrent'),
    update: (data: Record<string, unknown>) => ipcRenderer.invoke('project:update', data),
    getDefaultDir: () => ipcRenderer.invoke('project:getDefaultDir'),
    getLanguages: () => ipcRenderer.invoke('project:getLanguages'),
    setLanguages: (languages: string[], defaultLanguage: string) => ipcRenderer.invoke('project:setLanguages', languages, defaultLanguage)
  },

  // Documents
  doc: {
    list: (filters?: Record<string, unknown>) => ipcRenderer.invoke('doc:list', filters),
    get: (id: string) => ipcRenderer.invoke('doc:get', id),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('doc:create', data),
    save: (id: string, content: string) => ipcRenderer.invoke('doc:save', id, content),
    update: (id: string, data: Record<string, unknown>) => ipcRenderer.invoke('doc:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('doc:delete', id),
    getContent: (id: string) => ipcRenderer.invoke('doc:getContent', id),
    syncMentions: (documentId: string, entityIds: string[]) => ipcRenderer.invoke('doc:syncMentions', documentId, entityIds),
    reorder: (updates: Array<{ id: string; sort_order: number }>) => ipcRenderer.invoke('doc:reorder', updates),
    move: (id: string, parentId: string | null) => ipcRenderer.invoke('doc:move', id, parentId),
    setMode: (id: string, showDraft: boolean, currentContent: string) => ipcRenderer.invoke('doc:setMode', id, showDraft, currentContent),
    setCompleted: (id: string, completed: boolean, currentContent: string) => ipcRenderer.invoke('doc:setCompleted', id, completed, currentContent),
    copyDraftToFinal: (id: string, currentContent: string) => ipcRenderer.invoke('doc:copyDraftToFinal', id, currentContent),
    copyFinalToDraft: (id: string, currentContent: string) => ipcRenderer.invoke('doc:copyFinalToDraft', id, currentContent)
  },

  // Volumes
  vol: {
    list: () => ipcRenderer.invoke('vol:list'),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('vol:create', data),
    update: (id: string, data: Record<string, unknown>) => ipcRenderer.invoke('vol:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('vol:delete', id),
    reorder: (updates: Array<{ id: string; sort_order: number }>) => ipcRenderer.invoke('vol:reorder', updates)
  },

  // Entities
  entity: {
    list: (type?: string) => ipcRenderer.invoke('entity:list', type),
    get: (id: string) => ipcRenderer.invoke('entity:get', id),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('entity:create', data),
    update: (id: string, data: Record<string, unknown>) => ipcRenderer.invoke('entity:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('entity:delete', id),
    search: (query: string) => ipcRenderer.invoke('entity:search', query),
    getMentions: (entityId: string) => ipcRenderer.invoke('entity:getMentions', entityId),
    getRelations: (entityId: string) => ipcRenderer.invoke('entity:getRelations', entityId),
    getBody: (entityId: string) => ipcRenderer.invoke('entity:getBody', entityId),
    saveBody: (entityId: string, content: string) => ipcRenderer.invoke('entity:saveBody', entityId, content),
    reorder: (updates: Array<{ id: string; sort_order: number }>) => ipcRenderer.invoke('entity:reorder', updates),
    move: (id: string, parentId: string | null) => ipcRenderer.invoke('entity:move', id, parentId)
  },

  // Relations
  relation: {
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('relation:create', data),
    delete: (id: string) => ipcRenderer.invoke('relation:delete', id)
  },

  // Assets
  asset: {
    list: (filters?: Record<string, unknown>) => ipcRenderer.invoke('asset:list', filters),
    import: (assetType: string) => ipcRenderer.invoke('asset:import', assetType),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('asset:create', data),
    update: (id: string, data: Record<string, unknown>) => ipcRenderer.invoke('asset:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('asset:delete', id)
  },

  // Search
  search: {
    all: (query: string) => ipcRenderer.invoke('search:all', query),
    documents: (query: string, filters?: Record<string, unknown>) => ipcRenderer.invoke('search:documents', query, filters)
  },

  // Export
  export: {
    run: (profile: Record<string, unknown>) => ipcRenderer.invoke('export:run', profile),
    docx: (request: Record<string, unknown>) => ipcRenderer.invoke('export:docx', request)
  },

  // Translations
  translation: {
    list: (documentId?: string) => ipcRenderer.invoke('translation:list', documentId),
    get: (id: string) => ipcRenderer.invoke('translation:get', id),
    getByDocLocale: (documentId: string, locale: string) => ipcRenderer.invoke('translation:getByDocLocale', documentId, locale),
    create: (documentId: string, locale: string) => ipcRenderer.invoke('translation:create', documentId, locale),
    getContent: (id: string) => ipcRenderer.invoke('translation:getContent', id),
    saveContent: (id: string, content: string) => ipcRenderer.invoke('translation:saveContent', id, content),
    updateStatus: (id: string, status: string) => ipcRenderer.invoke('translation:updateStatus', id, status),
    delete: (id: string) => ipcRenderer.invoke('translation:delete', id),
    listLocales: () => ipcRenderer.invoke('translation:listLocales'),
    markOutdated: (documentId: string) => ipcRenderer.invoke('translation:markOutdated', documentId)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
