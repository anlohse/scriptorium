import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { getCurrentProjectPath } from './project'
import {
  createDocument, getDocument, updateDocument, deleteDocument, listDocuments,
  createVolume, listVolumes, updateVolume, deleteVolume,
  indexDocumentContent, updateDocumentWordCount, Document
} from '../db/documents'
import { syncMentions } from '../db/mentions'
import {
  readDocument, writeDocument, deleteDocumentFile,
  getDocumentPath, ensureUniqueFilePath, getDraftPath
} from '../fs'

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function resolveFilePath(projectPath: string, filePath: string): string {
  return filePath.startsWith(projectPath) ? filePath : `${projectPath}${filePath}`
}

function activeFilePath(projectPath: string, doc: Document): string {
  if (doc.show_draft && doc.draft_path) return resolveFilePath(projectPath, doc.draft_path)
  return resolveFilePath(projectPath, doc.final_path || doc.path)
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
    const content = readDocument(activeFilePath(projectPath, doc))
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

    if (data.is_folder) {
      const allDocs = listDocuments()
      const siblings = allDocs.filter(d =>
        d.type === data.type && d.is_folder === 1 &&
        (d.parent_id || null) === (data.parent_id || null)
      )
      const doc = createDocument({
        title: data.title,
        path: `folder:${randomUUID()}`,
        type: data.type,
        parent_id: data.parent_id || null,
        volume_id: null,
        sort_order: siblings.length,
        is_folder: 1,
        draft_path: null,
        final_path: null,
        show_draft: 1,
        completed: 0,
        tags: [],
        word_count: 0
      })
      return doc
    }

    const isDraftable = data.type === 'chapter' || data.type === 'scene'

    const volumes = listVolumes()
    const volume = data.volume_id ? volumes.find(v => v.id === data.volume_id) : null
    const rawFinalPath = getDocumentPath(projectPath, data.type, volume?.title || null, data.title)
    const finalPath = ensureUniqueFilePath(rawFinalPath)
    const draftPath = isDraftable ? getDraftPath(finalPath) : null

    const draftContent = data.content || `<h1>${data.title}</h1><p></p>`
    const finalContent = ''

    if (isDraftable) {
      writeDocument(finalPath, finalContent)
      writeDocument(draftPath!, draftContent)
    } else {
      writeDocument(finalPath, draftContent)
    }

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
      path: finalPath,
      type: data.type,
      parent_id: data.parent_id || null,
      volume_id: data.volume_id || null,
      sort_order,
      is_folder: 0,
      draft_path: draftPath,
      final_path: isDraftable ? finalPath : null,
      show_draft: 1,
      completed: 0,
      tags: [],
      word_count: 0
    })

    if (isDraftable) {
      indexDocumentContent(doc.id, doc.title, stripHtml(draftContent))
    } else {
      indexDocumentContent(doc.id, doc.title, stripHtml(draftContent))
    }
    return doc
  })

  ipcMain.handle('doc:save', (_event, id: string, content: string) => {
    const doc = getDocument(id)
    if (!doc || doc.is_folder) return { success: false }

    const projectPath = getCurrentProjectPath()!
    const filePath = activeFilePath(projectPath, doc)
    writeDocument(filePath, content)
    const plainText = stripHtml(content)
    updateDocumentWordCount(id, plainText)
    indexDocumentContent(id, doc.title, plainText)
    return { success: true }
  })

  ipcMain.handle('doc:setMode', (_event, id: string, showDraft: boolean, currentContent: string) => {
    const doc = getDocument(id)
    if (!doc || doc.is_folder || !doc.draft_path) return { success: false, content: '' }

    const projectPath = getCurrentProjectPath()!

    // Save current content to current file
    writeDocument(activeFilePath(projectPath, doc), currentContent)

    // Update show_draft in DB
    updateDocument(id, { show_draft: showDraft ? 1 : 0 })

    // Read and return new file content
    const updatedDoc = getDocument(id)!
    const content = readDocument(activeFilePath(projectPath, updatedDoc))
    return { success: true, content }
  })

  ipcMain.handle('doc:setCompleted', (_event, id: string, completed: boolean, currentContent: string) => {
    const doc = getDocument(id)
    if (!doc || doc.is_folder || !doc.draft_path) return { success: false, content: '' }

    const projectPath = getCurrentProjectPath()!

    // Save current content to current file
    writeDocument(activeFilePath(projectPath, doc), currentContent)

    // Completed → view final; not completed → view draft
    const showDraft = completed ? 0 : 1
    updateDocument(id, { completed: completed ? 1 : 0, show_draft: showDraft })

    // Return new file content
    const updatedDoc = getDocument(id)!
    const content = readDocument(activeFilePath(projectPath, updatedDoc))
    return { success: true, content }
  })

  ipcMain.handle('doc:copyDraftToFinal', (_event, id: string, currentContent: string) => {
    const doc = getDocument(id)
    if (!doc || doc.is_folder || !doc.draft_path || !doc.final_path) return { success: false }

    const projectPath = getCurrentProjectPath()!
    // Save current content first
    writeDocument(activeFilePath(projectPath, doc), currentContent)

    // Read draft, write to final
    const draftContent = readDocument(resolveFilePath(projectPath, doc.draft_path))
    writeDocument(resolveFilePath(projectPath, doc.final_path), draftContent)
    return { success: true }
  })

  ipcMain.handle('doc:copyFinalToDraft', (_event, id: string, currentContent: string) => {
    const doc = getDocument(id)
    if (!doc || doc.is_folder || !doc.draft_path || !doc.final_path) return { success: false }

    const projectPath = getCurrentProjectPath()!
    writeDocument(activeFilePath(projectPath, doc), currentContent)

    const finalContent = readDocument(resolveFilePath(projectPath, doc.final_path))
    writeDocument(resolveFilePath(projectPath, doc.draft_path), finalContent)
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

    // Delete both draft and final files
    if (doc.draft_path) deleteDocumentFile(resolveFilePath(projectPath, doc.draft_path))
    const finalOrPath = doc.final_path || doc.path
    deleteDocumentFile(resolveFilePath(projectPath, finalOrPath))

    deleteDocument(id)
    return { success: true }
  })

  ipcMain.handle('doc:getContent', (_event, id: string) => {
    const doc = getDocument(id)
    if (!doc || doc.is_folder) return ''
    const projectPath = getCurrentProjectPath()!
    return readDocument(activeFilePath(projectPath, doc))
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

    const siblings = listDocuments({ parent_id: newParentId })
      .filter(d => d.type === doc.type && d.id !== id)
    updateDocument(id, { parent_id: newParentId, sort_order: siblings.length })
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
