/// <reference types="vite/client" />

interface Window {
  api: {
    project: {
      create: (name: string, parentDir: string) => Promise<{ success: boolean; projectPath: string; config: import('./types').ProjectMetadata; error?: string }>
      open: (projectPath: string) => Promise<{ success?: boolean; canceled?: boolean; projectPath?: string; config?: import('./types').ProjectMetadata; error?: string }>
      openDialog: () => Promise<{ canceled?: boolean; success?: boolean; projectPath?: string; config?: import('./types').ProjectMetadata; error?: string }>
      createDialog: (name: string) => Promise<{ canceled?: boolean; success?: boolean; projectPath?: string; config?: import('./types').ProjectMetadata; error?: string }>
      close: () => Promise<{ success: boolean }>
      getCurrent: () => Promise<{ projectPath: string; config: import('./types').ProjectMetadata } | null>
      update: (data: Record<string, unknown>) => Promise<{ success: boolean; config?: import('./types').ProjectMetadata }>
      getDefaultDir: () => Promise<string>
      getLanguages: () => Promise<import('./types').LanguageConfig | null>
      setLanguages: (languages: string[], defaultLanguage: string) => Promise<{ success: boolean }>
    }
    doc: {
      list: (filters?: Record<string, unknown>) => Promise<import('./types').Document[]>
      get: (id: string) => Promise<import('./types').Document | null>
      create: (data: Record<string, unknown>) => Promise<import('./types').Document>
      save: (id: string, content: string) => Promise<{ success: boolean }>
      update: (id: string, data: Record<string, unknown>) => Promise<import('./types').Document | null>
      delete: (id: string) => Promise<{ success: boolean }>
      getContent: (id: string) => Promise<string>
      syncMentions: (documentId: string, entityIds: string[]) => Promise<{ success: boolean }>
      reorder: (updates: Array<{ id: string; sort_order: number }>) => Promise<{ success: boolean }>
    }
    vol: {
      list: () => Promise<import('./types').Volume[]>
      create: (data: Record<string, unknown>) => Promise<import('./types').Volume>
      update: (id: string, data: Record<string, unknown>) => Promise<import('./types').Volume>
      delete: (id: string) => Promise<{ success: boolean }>
      reorder: (updates: Array<{ id: string; sort_order: number }>) => Promise<{ success: boolean }>
    }
    entity: {
      list: (type?: string) => Promise<import('./types').Entity[]>
      get: (id: string) => Promise<import('./types').Entity | null>
      create: (data: Record<string, unknown>) => Promise<import('./types').Entity>
      update: (id: string, data: Record<string, unknown>) => Promise<import('./types').Entity | null>
      delete: (id: string) => Promise<{ success: boolean }>
      search: (query: string) => Promise<import('./types').Entity[]>
      getMentions: (entityId: string) => Promise<import('./types').Mention[]>
      getRelations: (entityId: string) => Promise<import('./types').Relation[]>
      getBody: (entityId: string) => Promise<string>
      saveBody: (entityId: string, content: string) => Promise<{ success: boolean }>
    }
    relation: {
      create: (data: Record<string, unknown>) => Promise<import('./types').Relation>
      delete: (id: string) => Promise<{ success: boolean }>
    }
    asset: {
      list: (filters?: Record<string, unknown>) => Promise<import('./types').Asset[]>
      import: (assetType: string) => Promise<{ canceled?: boolean; success?: boolean; path?: string; error?: string }>
      create: (data: Record<string, unknown>) => Promise<import('./types').Asset>
      update: (id: string, data: Record<string, unknown>) => Promise<import('./types').Asset | null>
      delete: (id: string) => Promise<{ success: boolean }>
    }
    search: {
      all: (query: string) => Promise<import('./types').SearchResult[]>
      documents: (query: string, filters?: Record<string, unknown>) => Promise<import('./types').SearchResult[]>
    }
    export: {
      run: (profile: Record<string, unknown>) => Promise<{ canceled?: boolean; success?: boolean; outputPath?: string; error?: string }>
      docx: (request: Record<string, unknown>) => Promise<{ success: boolean; outputPath?: string; warnings: Array<{ code: string; message: string }>; error?: string }>
    }
    translation: {
      list: (documentId?: string) => Promise<import('./types').Translation[]>
      get: (id: string) => Promise<import('./types').Translation | null>
      getByDocLocale: (documentId: string, locale: string) => Promise<import('./types').Translation | null>
      create: (documentId: string, locale: string) => Promise<import('./types').Translation>
      getContent: (id: string) => Promise<string>
      saveContent: (id: string, content: string) => Promise<{ success: boolean }>
      updateStatus: (id: string, status: string) => Promise<import('./types').Translation | null>
      delete: (id: string) => Promise<{ success: boolean }>
      listLocales: () => Promise<string[]>
      markOutdated: (documentId: string) => Promise<{ success: boolean }>
    }
  }
}
