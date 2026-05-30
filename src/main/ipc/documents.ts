import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
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

function isDocDescendant(ancestorId: string, nodeId: string): boolean {
  let currentId: string | null = nodeId
  const visited = new Set<string>()
  while (currentId) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    const doc = getDocument(currentId)
    if (!doc) break
    if (doc.parent_id === ancestorId) return true
    currentId = doc.parent_id
  }
  return false
}

export function registerDocumentHandlers(): void {
  ipcMain.handle('doc:list', (_event, filters) => {
    return listDocuments(filters)
  })

  ipcMain.handle('doc:get', (_event, id: string) => {
    const doc = getDocument(id)
    if (!doc) return null
    if (doc.is_folder) return { ...doc, content: '' }
    const projectPath = getCurrentProjectPath()!
    const content = readDocument(doc.path.startsWith(projectPath) ? doc.path : `${projectPath}${doc.path}`)
    return { ...doc, content }
  })

  ipcMain.handle('doc:create', (_event, data: {
    title: string
    type: Document['type']
    volume_id?: string
    parent_id?: string
    is_folder?: boolean
    content?: string
  }) => {
    const projectPath = getCurrentProjectPath()
    if (!projectPath) return { success: false, error: 'No project open' }

    // Folder creation — no file needed
    if (data.is_folder) {
      const allDocs = listDocuments()
      const siblings = allDocs.filter(d =>
        d.type === data.type &&
        d.is_folder === 1 &&
        (d.parent_id || null) === (data.parent_id || null)
      )
      const sort_order = siblings.length
      const folderPath = `folder:${randomUUID()}`
      const doc = createDocument({
        title: data.title,
        path: folderPath,
        type: data.type,
        parent_id: data.parent_id || null,
        volume_id: null,
        sort_order,
        is_folder: 1,
        tags: [],
        word_count: 0
      })
      return doc
    }

    const volumes = listVolumes()
    const volume = data.volume_id ? volumes.find(v => v.id === data.volume_id) : null
    const rawPath = getDocumentPath(projectPath, data.type, volume?.title || null, data.title)
    const filePath = ensureUniqueFilePath(rawPath)

    const content = data.content || `<h1>${data.title}</h1><p></p>`
    writeDocument(filePath, content)

    const allDocs = listDocuments()
    let sort_order = 0
    if (data.parent_id) {
      sort_order = allDocs.filter(d => d.parent_id === data.parent_id && d.type === data.type && !d.is_folder).length
    } else if (data.volume_id) {
      sort_order = allDocs.filter(d => d.volume_id === data.volume_id && d.type === data.type && !d.parent_id && !d.is_folder).length
    } else {
      sort_order = allDocs.filter(d => !d.volume_id && !d.parent_id && d.type === data.type && !d.is_folder).length
    }

    const doc = createDocument({
      title: data.title,
      path: filePath,
      type: data.type,
      parent_id: data.parent_id || null,
      volume_id: data.volume_id || null,
      sort_order,
      is_folder: 0,
      tags: [],
      word_count: content.split(/\s+/).length
    })

    indexDocumentContent(doc.id, doc.title, stripHtml(content))
    return doc
  })

  ipcMain.handle('doc:save', (_event, id: string, content: string) => {
    const doc = getDocument(id)
    if (!doc || doc.is_folder) return { success: false }

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

    if (doc.is_folder) {
      const children = listDocuments({ parent_id: id })
      if (children.length > 0) {
        return { success: false, error: 'Folder is not empty. Move or delete its contents first.' }
      }
      deleteDocument(id)
      return { success: true }
    }

    const projectPath = getCurrentProjectPath()!
    const filePath = doc.path.startsWith(projectPath) ? doc.path : `${projectPath}${doc.path}`
    deleteDocumentFile(filePath)
    deleteDocument(id)
    return { success: true }
  })

  ipcMain.handle('doc:getContent', (_event, id: string) => {
    const doc = getDocument(id)
    if (!doc || doc.is_folder) return ''
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

  ipcMain.handle('doc:move', (_event, id: string, newParentId: string | null) => {
    const doc = getDocument(id)
    if (!doc) return { success: false, error: 'Document not found' }

    if (newParentId) {
      const newParent = getDocument(newParentId)
      if (!newParent || !newParent.is_folder) return { success: false, error: 'Target is not a folder' }
      if (newParentId === id) return { success: false, error: 'Cannot move a folder into itself' }
      if (doc.is_folder && isDocDescendant(id, newParentId)) {
        return { success: false, error: 'Cannot move a folder into its own subfolder' }
      }
    }

    // Compute sort_order at destination
    const siblings = listDocuments({ parent_id: newParentId })
      .filter(d => d.type === doc.type && d.id !== id)
    const sort_order = siblings.length

    updateDocument(id, { parent_id: newParentId, sort_order })
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
