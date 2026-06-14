import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { DecorationSet, Decoration } from '@tiptap/pm/view'
import type { Node as PmNode } from '@tiptap/pm/model'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    localSearch: {
      setLocalSearch: (term: string) => ReturnType
      findNext: () => ReturnType
      findPrev: () => ReturnType
      clearLocalSearch: () => ReturnType
    }
  }
}

export const LOCAL_SEARCH_KEY = new PluginKey<LocalSearchState>('localSearch')

interface Match { from: number; to: number }

interface LocalSearchState {
  term: string
  matches: Match[]
  current: number
  decorations: DecorationSet
}

function findMatches(doc: PmNode, term: string): Match[] {
  if (!term) return []
  const lower = term.toLowerCase()
  const matches: Match[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true
    const text = node.text.toLowerCase()
    let i = 0
    while ((i = text.indexOf(lower, i)) !== -1) {
      matches.push({ from: pos + i, to: pos + i + term.length })
      i += 1
    }
    return true
  })
  return matches
}

function buildDecorations(doc: PmNode, matches: Match[], current: number): DecorationSet {
  if (matches.length === 0) return DecorationSet.empty
  const decos = matches.map((m, i) =>
    Decoration.inline(m.from, m.to, {
      class: i === current ? 'local-search-current' : 'local-search-match'
    })
  )
  return DecorationSet.create(doc, decos)
}

const EMPTY: LocalSearchState = { term: '', matches: [], current: 0, decorations: DecorationSet.empty }

export const LocalSearch = Extension.create({
  name: 'localSearch',

  addCommands() {
    return {
      setLocalSearch: (term: string) => ({ editor, dispatch, tr }) => {
        const matches = findMatches(editor.state.doc, term)
        const current = 0
        const decorations = buildDecorations(editor.state.doc, matches, current)
        if (dispatch) {
          dispatch(tr.setMeta(LOCAL_SEARCH_KEY, { term, matches, current, decorations }))
          if (matches.length > 0) {
            editor.view.dom.querySelector('.local-search-current')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }
        return true
      },

      findNext: () => ({ editor, dispatch, tr }) => {
        const state = LOCAL_SEARCH_KEY.getState(editor.state)
        if (!state || state.matches.length === 0) return false
        const current = (state.current + 1) % state.matches.length
        const decorations = buildDecorations(editor.state.doc, state.matches, current)
        if (dispatch) {
          dispatch(tr.setMeta(LOCAL_SEARCH_KEY, { ...state, current, decorations }))
          editor.view.dom.querySelector('.local-search-current')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        return true
      },

      findPrev: () => ({ editor, dispatch, tr }) => {
        const state = LOCAL_SEARCH_KEY.getState(editor.state)
        if (!state || state.matches.length === 0) return false
        const current = (state.current - 1 + state.matches.length) % state.matches.length
        const decorations = buildDecorations(editor.state.doc, state.matches, current)
        if (dispatch) {
          dispatch(tr.setMeta(LOCAL_SEARCH_KEY, { ...state, current, decorations }))
          editor.view.dom.querySelector('.local-search-current')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        return true
      },

      clearLocalSearch: () => ({ dispatch, tr }) => {
        if (dispatch) dispatch(tr.setMeta(LOCAL_SEARCH_KEY, EMPTY))
        return true
      }
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: LOCAL_SEARCH_KEY,

        state: {
          init: () => EMPTY,
          apply(tr, prev) {
            const meta = tr.getMeta(LOCAL_SEARCH_KEY) as LocalSearchState | undefined
            if (meta) return meta
            if (tr.docChanged && prev.term) {
              const matches = findMatches(tr.doc, prev.term)
              const current = Math.min(prev.current, Math.max(0, matches.length - 1))
              return { ...prev, matches, current, decorations: buildDecorations(tr.doc, matches, current) }
            }
            return prev
          }
        },

        props: {
          decorations(state) {
            return LOCAL_SEARCH_KEY.getState(state)?.decorations ?? DecorationSet.empty
          }
        }
      })
    ]
  }
})
