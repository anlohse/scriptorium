import { ipcMain } from 'electron'
import {
  createTranslation, getTranslation, getTranslationByDocLocale, listTranslations,
  updateTranslation, deleteTranslation, listLocales, markTranslationsOutdated,
  Translation
} from '../db/translations'
import {
  ensureTranslationLocale, getTranslationFilePath, getDocRelPath,
  readTranslationFile, writeTranslationFile, deleteTranslationFile,
  readEntityBody, writeEntityBody
} from '../fs'
import { getCurrentProjectPath } from './project'
import { getDb } from '../db'

export function registerTranslationHandlers(): void {
  ipcMain.handle('translation:list', (_event, documentId?: string) => {
    return listTranslations(documentId)
  })

  ipcMain.handle('translation:get', (_event, id: string) => {
    return getTranslation(id)
  })

  ipcMain.handle('translation:getByDocLocale', (_event, documentId: string, locale: string) => {
    return getTranslationByDocLocale(documentId, locale)
  })

  ipcMain.handle('translation:create', (_event, documentId: string, locale: string) => {
    const projectPath = getCurrentProjectPath()
    if (!projectPath) throw new Error('No project open')

    // Get document path from DB
    const doc = getDb().prepare('SELECT path FROM documents WHERE id = ?').get(documentId) as { path: string } | undefined
    if (!doc) throw new Error('Document not found')

    ensureTranslationLocale(projectPath, locale)
    const docRelPath = getDocRelPath(projectPath, doc.path)
    const translationPath = getTranslationFilePath(projectPath, locale, docRelPath)

    // Create initial translation file with YAML frontmatter
    const initialContent = `---\ntranslationOf: ${documentId}\nlocale: ${locale}\nstatus: draft\n---\n\n`
    writeTranslationFile(translationPath, initialContent)

    return createTranslation({
      document_id: documentId,
      locale,
      path: translationPath,
      status: 'draft',
      source_version: 0,
      translated_version: 0
    })
  })

  ipcMain.handle('translation:getContent', (_event, id: string) => {
    const t = getTranslation(id)
    if (!t) return ''
    return readTranslationFile(t.path)
  })

  ipcMain.handle('translation:saveContent', (_event, id: string, content: string) => {
    const t = getTranslation(id)
    if (!t) return { success: false }
    writeTranslationFile(t.path, content)
    updateTranslation(id, { status: t.status === 'untranslated' ? 'draft' : t.status })
    return { success: true }
  })

  ipcMain.handle('translation:updateStatus', (_event, id: string, status: Translation['status']) => {
    return updateTranslation(id, { status })
  })

  ipcMain.handle('translation:delete', (_event, id: string) => {
    const t = getTranslation(id)
    if (t) deleteTranslationFile(t.path)
    deleteTranslation(id)
    return { success: true }
  })

  ipcMain.handle('translation:listLocales', () => {
    return listLocales()
  })

  ipcMain.handle('translation:markOutdated', (_event, documentId: string) => {
    markTranslationsOutdated(documentId)
    return { success: true }
  })

  ipcMain.handle('entity:getBody', (_event, entityId: string) => {
    const projectPath = getCurrentProjectPath()
    if (!projectPath) return ''
    return readEntityBody(projectPath, entityId)
  })

  ipcMain.handle('entity:saveBody', (_event, entityId: string, content: string) => {
    const projectPath = getCurrentProjectPath()
    if (!projectPath) return { success: false }
    writeEntityBody(projectPath, entityId, content)
    return { success: true }
  })
}
