import { ipcMain } from 'electron'
import { getCurrentProjectPath } from './project'
import {
  createDocument, getDocument, updateDocument, deleteDocument, listDocuments,
  createVolume, listVolumes, updateVolume, deleteVolume,
  indexDocumentContent, updateDocumentWordCount, Document
} from '../db/documents'
import { syncMentions } from '../db/mentions'
import { readDocument, writeDocument, deleteDocumentFile, getDocumentPath, ensureUniqueFilePath } from '../fs'

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function registerDocumentHandlers(): void {
  ipcMain.handle('doc:list', (_event, filters) => {
    return listDocuments(filters)
  })

  ipcMain.handle('doc:get', (_event, id: string) => {
    const doc = getDocument(id)
    if (!doc) return null
    const projectPath = getCurrentProjectPath()!
    const content = readDocument(doc.path.startsWith(projectPath) ? doc.path : `${projectPath}${doc.path}`)
    return { ...doc, content }
  })

  ipcMain.handle('doc:create', (_event, data: {
    title: string
    type: Document['type']
    volume_id?: string
    parent_id?: string
    content?: string
  }) => {
    const projectPath = getCurrentProjectPath()
    if (!projectPath) return { success: false, error: 'No project open' }

    const volumes = listVolumes()
    const volume = data.volume_id ? volumes.find(v => v.id === data.volume_id) : null
    const rawPath = getDocumentPath(projectPath, data.type, volume?.title || null, data.title)
    const filePath = ensureUniqueFilePath(rawPath)

    const content = data.content || `<h1>${data.title}</h1><p></p>`
    writeDocument(filePath, content)

    const allDocs = listDocuments()
    let sort_order = 0
    if (data.parent_id) {
      sort_order = allDocs.filter(d => d.parent_id === data.parent_id && d.type === data.type).length
    } else if (data.volume_id) {
      sort_order = allDocs.filter(d => d.volume_id === data.volume_id && d.type === data.type && !d.parent_id).length
    } else {
      sort_order = allDocs.filter(d => !d.volume_id && !d.parent_id && d.type === data.type).length
    }

    const doc = createDocument({
      title: data.title,
      path: filePath,
      type: data.type,
      parent_id: data.parent_id || null,
      volume_id: data.volume_id || null,
      sort_order,
      tags: [],
      word_count: content.split(/\s+/).length
    })

    indexDocumentContent(doc.id, doc.title, stripHtml(content))
    return doc
  })

  ipcMain.handle('doc:save', (_event, id: string, content: string) => {
    const doc = getDocument(id)
    if (!doc) return { success: false }

    const projectPath = getCurrentProjectPath()!
    const filePath = doc.path.startsWith(projectPath) ? doc.path : `${projectPath}${doc.path}`
    writeDocument(filePath, content)
    const plainText = stripHtml(content)
    updateDocumentWordCount(id, plainText)
    indexDocumentContent(id, doc.title, plainText)
    return { success: true }
  })

  ipcMain.handle('doc:update', (_event, id: string, data: Partial<Document>) => {
    return updateDocument(id, data)
  })

  ipcMain.handle('doc:delete', (_event, id: string) => {
    const doc = getDocument(id)
    if (!doc) return { success: false }
    const projectPath = getCurrentProjectPath()!
    const filePath = doc.path.startsWith(projectPath) ? doc.path : `${projectPath}${doc.path}`
    deleteDocumentFile(filePath)
    deleteDocument(id)
    return { success: true }
  })

  ipcMain.handle('doc:getContent', (_event, id: string) => {
    const doc = getDocument(id)
    if (!doc) return null
    const projectPath = getCurrentProjectPath()!
    const filePath = doc.path.startsWith(projectPath) ? doc.path : `${projectPath}${doc.path}`
    return readDocument(filePath)
  })

  ipcMain.handle('doc:syncMentions', (_event, documentId: string, entityIds: string[]) => {
    syncMentions(documentId, entityIds)
    return { success: true }
  })

  ipcMain.handle('doc:reorder', (_event, updates: Array<{ id: string; sort_order: number }>) => {
    for (const { id, sort_order } of updates) {
      updateDocument(id, { sort_order })
    }
    return { success: true }
  })

  // Volumes
  ipcMain.handle('vol:list', () => listVolumes())

  ipcMain.handle('vol:create', (_event, data: { title: string }) => {
    const volumes = listVolumes()
    return createVolume({ title: data.title, sort_order: volumes.length })
  })

  ipcMain.handle('vol:update', (_event, id: string, data: { title?: string; sort_order?: number }) => {
    return updateVolume(id, data)
  })

  ipcMain.handle('vol:delete', (_event, id: string) => {
    deleteVolume(id)
    return { success: true }
  })

  ipcMain.handle('vol:reorder', (_event, updates: Array<{ id: string; sort_order: number }>) => {
    for (const { id, sort_order } of updates) {
      updateVolume(id, { sort_order })
    }
    return { success: true }
  })
}
