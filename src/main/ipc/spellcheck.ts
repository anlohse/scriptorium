import { ipcMain } from 'electron'
import { getCurrentProjectPath } from './project'
import { checkWords, addWord } from '../spellcheck/dictionaryLoader'
import { readCustomDict, writeCustomDictWord } from '../fs'

export function registerSpellCheckHandlers(): void {
  // Check a batch of words. Returns only the misspelled ones: { word → suggestions[] }
  ipcMain.handle('spell:checkWords', (_event, locale: string, words: string[], projectPath: string) => {
    const path = projectPath || getCurrentProjectPath()
    if (!path) return {}
    return checkWords(locale, path, words)
  })

  // Add a word to the project's custom dictionary for the given locale
  ipcMain.handle('spell:addWord', async (_event, word: string, locale: string, projectPath: string) => {
    const path = projectPath || getCurrentProjectPath()
    if (!path || !word.trim()) return { success: false }
    try {
      writeCustomDictWord(path, locale, word.trim())
      addWord(locale, path, word.trim())
      return { success: true }
    } catch (err) {
      console.error('[spell] Failed to add word:', err)
      return { success: false, error: String(err) }
    }
  })

  // Return all custom words for a locale in the current project
  ipcMain.handle('spell:getCustomWords', (_event, locale: string, projectPath: string) => {
    const path = projectPath || getCurrentProjectPath()
    if (!path) return []
    return readCustomDict(path, locale)
  })
}
