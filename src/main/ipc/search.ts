import { ipcMain } from 'electron'
import { searchQuery, type SearchScope } from '../db/search'

export function registerSearchHandlers(): void {
  ipcMain.handle('search:query', (_event, query: string, scope: SearchScope) => {
    return searchQuery(query, scope)
  })
}
