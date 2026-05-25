import { ipcMain } from 'electron'
import { searchAll, searchDocuments } from '../db/search'

export function registerSearchHandlers(): void {
  ipcMain.handle('search:all', (_event, query: string) => {
    return searchAll(query)
  })

  ipcMain.handle('search:documents', (_event, query: string, filters?: { type?: string; volume_id?: string }) => {
    return searchDocuments(query, filters)
  })
}
