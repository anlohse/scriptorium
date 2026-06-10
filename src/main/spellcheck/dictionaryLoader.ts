import { Worker } from 'worker_threads'
import { join, dirname } from 'path'
import { readCustomDict } from '../fs'

// ─── Module paths resolved once at startup ───────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const NSPELL_PATH: string = require.resolve('nspell')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const EN_DICT_PATH: string = require.resolve('dictionary-en-us')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PT_BR_TRIE_PATH: string = join(dirname(require.resolve('@cspell/dict-pt-br/cspell-ext.json')), 'pt_BR.trie.gz')

// ─── Worker source for en-US (nspell, synchronous CJS) ───────────────────────

const NSPELL_WORKER_SRC = `
const { workerData, parentPort } = require('worker_threads')
const nspell  = require(workerData.nspellPath)
const loader  = require(workerData.dictPkgPath)

loader(function(err, dict) {
  if (err) { parentPort.postMessage({ type: 'error', error: err.message }); return }
  const checker = nspell(dict)
  for (const w of workerData.customWords) {
    if (w && w.trim()) checker.add(w.trim())
  }
  parentPort.postMessage({ type: 'ready' })
  parentPort.on('message', function(msg) {
    if (msg.type === 'check') {
      const result = {}
      for (const word of msg.words) {
        if (!checker.correct(word)) result[word] = checker.suggest(word).slice(0, 5)
      }
      parentPort.postMessage({ type: 'result', id: msg.id, result: result })
    } else if (msg.type === 'addWord') {
      checker.add(msg.word)
    }
  })
})
`

// ─── Worker source for pt-BR (cspell-lib, ESM via dynamic import) ────────────
// Uses dynamic import() so the ESM-only cspell-lib can be consumed from a
// CJS-eval worker thread. Custom words are held in a mutable Set so addWord
// works without reloading the dictionary.

const CSPELL_WORKER_SRC = `
const { workerData, parentPort } = require('worker_threads')

async function main() {
  const { getDictionary, createSpellingDictionary, createSpellingDictionaryCollection } = await import('cspell-lib')
  const baseDict = await getDictionary({
    dictionaryDefinitions: [{ name: 'pt-br', path: workerData.triePath }],
    dictionaries: ['pt-br']
  })

  const customSet = new Set(workerData.customWords.map(w => w.trim().toLowerCase()).filter(Boolean))
  const getDict = () => {
    if (customSet.size === 0) return baseDict
    const customDict = createSpellingDictionary(Array.from(customSet), 'custom', 'custom')
    return createSpellingDictionaryCollection([baseDict, customDict])
  }
  let dict = getDict()

  parentPort.postMessage({ type: 'ready' })

  parentPort.on('message', function(msg) {
    if (msg.type === 'check') {
      const result = {}
      for (const word of msg.words) {
        if (!dict.has(word, {})) {
          result[word] = dict.suggest(word, {}).slice(0, 5).map(s => s.word)
        }
      }
      parentPort.postMessage({ type: 'result', id: msg.id, result: result })
    } else if (msg.type === 'addWord') {
      customSet.add(msg.word.trim().toLowerCase())
      dict = getDict()
    }
  })
}

main().catch(err => parentPort.postMessage({ type: 'error', error: err.message }))
`

// ─── Speller pool ─────────────────────────────────────────────────────────────

interface PendingCheck {
  resolve: (result: Record<string, string[]>) => void
}

interface SpellerState {
  worker: Worker
  ready: boolean
  nextId: number
  pending: Map<number, PendingCheck>
  queue: Array<{ id: number; words: string[]; resolve: (r: Record<string, string[]>) => void }>
}

const spellers = new Map<string, SpellerState>()

export function getSupportedLocales(): string[] {
  return ['en-US', 'pt-BR']
}

function createSpeller(locale: string, projectPath: string): SpellerState | null {
  const customWords = readCustomDict(projectPath, locale)
  let worker: Worker

  if (locale === 'pt-BR') {
    worker = new Worker(CSPELL_WORKER_SRC, {
      eval: true,
      workerData: { triePath: PT_BR_TRIE_PATH, customWords }
    })
  } else if (locale === 'en-US') {
    worker = new Worker(NSPELL_WORKER_SRC, {
      eval: true,
      workerData: { nspellPath: NSPELL_PATH, dictPkgPath: EN_DICT_PATH, customWords }
    })
  } else {
    console.warn(`[spell] Unsupported locale: ${locale}`)
    return null
  }

  const state: SpellerState = { worker, ready: false, nextId: 0, pending: new Map(), queue: [] }
  const key = `${locale}:${projectPath}`

  worker.on('message', (msg) => {
    if (msg.type === 'ready') {
      state.ready = true
      for (const item of state.queue) {
        worker.postMessage({ type: 'check', id: item.id, words: item.words })
        state.pending.set(item.id, { resolve: item.resolve })
      }
      state.queue = []
    } else if (msg.type === 'result') {
      const req = state.pending.get(msg.id)
      if (req) { state.pending.delete(msg.id); req.resolve(msg.result) }
    } else if (msg.type === 'error') {
      console.error(`[spell] Worker error (${locale}):`, msg.error)
      for (const req of state.pending.values()) req.resolve({})
      state.pending.clear()
      spellers.delete(key)
    }
  })

  worker.on('error', (err) => {
    console.error(`[spell] Worker crash (${locale}):`, err)
    for (const req of state.pending.values()) req.resolve({})
    state.pending.clear()
    spellers.delete(key)
  })

  return state
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function checkWords(locale: string, projectPath: string, words: string[]): Promise<Record<string, string[]>> {
  const key = `${locale}:${projectPath}`
  if (!spellers.has(key)) {
    const state = createSpeller(locale, projectPath)
    if (!state) return Promise.resolve({})
    spellers.set(key, state)
  }

  const speller = spellers.get(key)!
  return new Promise((resolve) => {
    const id = speller.nextId++
    if (speller.ready) {
      speller.worker.postMessage({ type: 'check', id, words })
      speller.pending.set(id, { resolve })
    } else {
      speller.queue.push({ id, words, resolve })
    }
  })
}

export function addWord(locale: string, projectPath: string, word: string): void {
  const speller = spellers.get(`${locale}:${projectPath}`)
  if (speller?.ready) speller.worker.postMessage({ type: 'addWord', word })
  // If not ready yet, the word is in the custom dict file and will be loaded
  // when the worker initialises (readCustomDict is called at worker start).
}

export function invalidateSpeller(locale: string, projectPath: string): void {
  const key = `${locale}:${projectPath}`
  const speller = spellers.get(key)
  if (speller) {
    speller.worker.terminate().catch(() => {})
    spellers.delete(key)
  }
}
