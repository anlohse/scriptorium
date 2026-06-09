import NSpell from 'nspell'
import { readCustomDict } from '../fs'

type SpellChecker = NSpell

const checkerCache = new Map<string, SpellChecker>()
const pendingLoads = new Map<string, Promise<SpellChecker | null>>()

const LOCALE_PKG: Record<string, string> = {
  'en-US': 'dictionary-en-us',
  'pt-BR': 'dictionary-pt-br'
}

function loadDictPackage(pkg: string): Promise<{ aff: Buffer; dic: Buffer }> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loader = require(pkg) as (cb: (err: Error | null, r: { aff: Buffer; dic: Buffer }) => void) => void
    loader((err, r) => (err ? reject(err) : resolve(r)))
  })
}

export function getSupportedLocales(): string[] {
  return Object.keys(LOCALE_PKG)
}

export async function getOrCreateChecker(locale: string, projectPath: string): Promise<SpellChecker | null> {
  const key = `${locale}:${projectPath}`
  if (checkerCache.has(key)) return checkerCache.get(key)!

  const pkg = LOCALE_PKG[locale]
  if (!pkg) {
    console.warn(`[spell] Unsupported locale: ${locale}`)
    return null
  }

  if (pendingLoads.has(key)) return pendingLoads.get(key)!

  const promise = loadDictPackage(pkg)
    .then(dict => {
      const checker = NSpell(dict)
      for (const w of readCustomDict(projectPath, locale)) {
        if (w.trim()) checker.add(w.trim())
      }
      checkerCache.set(key, checker)
      pendingLoads.delete(key)
      return checker as SpellChecker
    })
    .catch(err => {
      console.error(`[spell] Failed to load dictionary for ${locale}:`, err)
      pendingLoads.delete(key)
      return null
    })

  pendingLoads.set(key, promise)
  return promise
}

export function addWordToChecker(locale: string, projectPath: string, word: string): void {
  const checker = checkerCache.get(`${locale}:${projectPath}`)
  if (checker && word.trim()) checker.add(word.trim())
}

export function invalidateChecker(locale: string, projectPath: string): void {
  const key = `${locale}:${projectPath}`
  checkerCache.delete(key)
  pendingLoads.delete(key)
}
