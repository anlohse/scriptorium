import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { DecorationSet, Decoration } from '@tiptap/pm/view'
import type { EditorView } from '@tiptap/pm/view'
import type { Node as PmNode } from '@tiptap/pm/model'
import { useProjectStore } from '../../stores/projectStore'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    spellCheck: {
      setSpellCheckEnabled: (enabled: boolean) => ReturnType
      setSpellCheckLocale: (locale: string) => ReturnType
      ignoreSpellWord: (word: string) => ReturnType
      addSpellWord: (word: string) => ReturnType
      triggerSpellCheck: () => ReturnType
    }
  }
}

export const SPELL_PLUGIN_KEY = new PluginKey<DecorationSet>('spellCheck')

const WORD_RE = /[\p{L}]+(?:['’‘-][\p{L}]+)*/gu
const CHECK_DELAY = 750
const SKIP_TYPES = new Set(['codeBlock', 'pageBreak', 'horizontalRule'])

interface TextRange { text: string; from: number }

function extractTextRanges(doc: PmNode): TextRange[] {
  const out: TextRange[] = []
  doc.descendants((node, pos) => {
    if (SKIP_TYPES.has(node.type.name)) return false
    if (node.isText && node.text) out.push({ text: node.text, from: pos })
    return true
  })
  return out
}

// Module-level timer so we can cancel it from commands
let pendingTimer: ReturnType<typeof setTimeout> | null = null

function clearPendingTimer(): void {
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null }
}

function scheduleCheck(
  view: EditorView,
  storage: { enabled: boolean; locale: string; ignoredWords: Set<string> },
  delay = CHECK_DELAY
): void {
  clearPendingTimer()
  if (!storage.enabled) return
  pendingTimer = setTimeout(() => {
    pendingTimer = null
    doCheck(view, storage).catch(console.error)
  }, delay)
}

async function doCheck(
  view: EditorView,
  storage: { enabled: boolean; locale: string; ignoredWords: Set<string> }
): Promise<void> {
  if (!storage.enabled || !view.editable) return

  const doc = view.state.doc
  const ranges = extractTextRanges(doc)
  if (ranges.length === 0) {
    view.dispatch(view.state.tr.setMeta(SPELL_PLUGIN_KEY, DecorationSet.empty))
    return
  }

  // Collect occurrences and unique words
  const occurrences: Array<{ word: string; from: number; to: number }> = []
  const unique = new Set<string>()

  for (const { text, from } of ranges) {
    WORD_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = WORD_RE.exec(text)) !== null) {
      const word = m[0]
      if (!storage.ignoredWords.has(word.toLowerCase())) {
        occurrences.push({ word, from: from + m.index, to: from + m.index + word.length })
        unique.add(word)
      }
    }
  }

  const projectPath = useProjectStore.getState().projectPath ?? ''
  if (!projectPath || unique.size === 0) {
    view.dispatch(view.state.tr.setMeta(SPELL_PLUGIN_KEY, DecorationSet.empty))
    return
  }

  let misspelled: Record<string, string[]>
  try {
    misspelled = await window.api.spell.checkWords(storage.locale, Array.from(unique), projectPath)
  } catch {
    return
  }

  // Doc may have changed during the await — discard stale results
  if (view.state.doc !== doc) return

  const decos: Decoration[] = []
  for (const { word, from, to } of occurrences) {
    if (word in misspelled) {
      decos.push(
        Decoration.inline(from, to, {
          class: 'spell-error',
          'data-spell-word': word,
          'data-spell-from': String(from),
          'data-spell-to': String(to),
          'data-spell-suggestions': JSON.stringify(misspelled[word])
        })
      )
    }
  }

  view.dispatch(view.state.tr.setMeta(SPELL_PLUGIN_KEY, DecorationSet.create(doc, decos)))
}

export const SpellCheck = Extension.create({
  name: 'spellCheck',

  addStorage() {
    return {
      enabled: true,
      locale: 'en-US',
      ignoredWords: new Set<string>()
    }
  },

  addCommands() {
    return {
      setSpellCheckEnabled: (enabled: boolean) => ({ editor }) => {
        editor.storage.spellCheck.enabled = enabled
        if (!enabled) {
          clearPendingTimer()
          editor.view.dispatch(editor.state.tr.setMeta(SPELL_PLUGIN_KEY, DecorationSet.empty))
        } else {
          scheduleCheck(editor.view, editor.storage.spellCheck, 0)
        }
        return true
      },

      setSpellCheckLocale: (locale: string) => ({ editor }) => {
        editor.storage.spellCheck.locale = locale
        if (editor.storage.spellCheck.enabled) {
          scheduleCheck(editor.view, editor.storage.spellCheck, 0)
        }
        return true
      },

      ignoreSpellWord: (word: string) => ({ editor }) => {
        const lower = word.toLowerCase()
        editor.storage.spellCheck.ignoredWords.add(lower)
        const pluginState = SPELL_PLUGIN_KEY.getState(editor.state)
        if (pluginState) {
          const decos = pluginState.find(undefined, undefined, spec => spec['data-spell-word']?.toLowerCase() === lower)
          if (decos.length > 0) {
            editor.view.dispatch(editor.state.tr.setMeta(SPELL_PLUGIN_KEY, pluginState.remove(decos)))
          }
        }
        return true
      },

      addSpellWord: (word: string) => ({ editor }) => {
        const { locale } = editor.storage.spellCheck
        const projectPath = useProjectStore.getState().projectPath ?? ''
        if (!projectPath) return true
        // Remove decorations immediately
        const lower = word.toLowerCase()
        editor.storage.spellCheck.ignoredWords.add(lower)
        const pluginState = SPELL_PLUGIN_KEY.getState(editor.state)
        if (pluginState) {
          const decos = pluginState.find(undefined, undefined, spec => spec['data-spell-word']?.toLowerCase() === lower)
          if (decos.length > 0) {
            editor.view.dispatch(editor.state.tr.setMeta(SPELL_PLUGIN_KEY, pluginState.remove(decos)))
          }
        }
        // Persist to file + update main-process checker
        window.api.spell.addWord(word, locale, projectPath).catch(console.error)
        return true
      },

      triggerSpellCheck: () => ({ editor }) => {
        scheduleCheck(editor.view, editor.storage.spellCheck, 0)
        return true
      }
    }
  },

  addProseMirrorPlugins() {
    const storage = this.storage as {
      enabled: boolean
      locale: string
      ignoredWords: Set<string>
    }

    return [
      new Plugin({
        key: SPELL_PLUGIN_KEY,

        state: {
          init: () => DecorationSet.empty,
          apply(tr, prev, _old, newState) {
            const meta = tr.getMeta(SPELL_PLUGIN_KEY)
            if (meta instanceof DecorationSet) return meta
            if (tr.docChanged) return prev.map(tr.mapping, newState.doc)
            return prev
          }
        },

        props: {
          decorations(state) {
            return SPELL_PLUGIN_KEY.getState(state)
          }
        },

        view(editorView) {
          return {
            update(view, prevState) {
              // Only re-check when document content actually changed
              if (view.state.doc === prevState.doc) return
              scheduleCheck(view, storage)
            },
            destroy() {
              clearPendingTimer()
            }
          }
        }
      })
    ]
  }
})
