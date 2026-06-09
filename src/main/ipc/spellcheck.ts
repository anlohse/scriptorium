import { ipcMain } from 'electron'
import { getCurrentProjectPath } from './project'
import { getOrCreateChecker, addWordToChecker } from '../spellcheck/dictionaryLoader'
import { readCustomDict, writeCustomDictWord } from '../fs'

export function registerSpellCheckHandlers(): void {
  // Check a batch of words. Returns only misspelled ones: { word → suggestions[] }
  ipcMain.handle('spell:checkWords', async (_event, locale: string, words: string[], projectPath: string) => {
    const path = projectPath || getCurrentProjectPath()
    if (!path) return {}

    const checker = await getOrCreateChecker(locale, path)
    if (!checker) return {}

    const result: Record<string, string[]> = {}
    for (const word of words) {
      if (!checker.correct(word)) {
        result[word] = checker.suggest(word).slice(0, 5)
      }
    }
    return result
  })

  // Add a word to the project's custom dictionary for the given locale
  ipcMain.handle('spell:addWord', async (_event, word: string, locale: string, projectPath: string) => {
    const path = projectPath || getCurrentProjectPath()
    if (!path || !word.trim()) return { success: false }

    try {
      writeCustomDictWord(path, locale, word.trim())
      addWordToChecker(locale, path, word.trim())
      return { success: true }
    } catch (err) {
      console.error('[spell] Failed to add word:', err)
      return { success: false, error: String(err) }
    }
  })

  // Get all custom words for a locale in the current project
  ipcMain.handle('spell:getCustomWords', async (_event, locale: string, projectPath: string) => {
    const path = projectPath || getCurrentProjectPath()
    if (!path) return []
    return readCustomDict(path, locale)
  })
}
