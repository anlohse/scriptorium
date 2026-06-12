import React, { useEffect, useRef, useState } from 'react'
import { X, ChevronUp, ChevronDown } from 'lucide-react'
import type { Editor } from '@tiptap/react'
import { LOCAL_SEARCH_KEY } from './LocalSearchExtension'

interface Props {
  editor: Editor
  onClose: () => void
}

export function LocalSearchBar({ editor, onClose }: Props): React.ReactElement {
  const [term, setTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const pluginState = LOCAL_SEARCH_KEY.getState(editor.state)
  const matchCount = pluginState?.matches.length ?? 0
  const current = (pluginState?.current ?? 0) + 1

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    editor.commands.setLocalSearch(term)
  }, [term]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = (): void => {
    editor.commands.clearLocalSearch()
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') { handleClose(); return }
    if (e.key === 'Enter') {
      e.shiftKey ? editor.commands.findPrev() : editor.commands.findNext()
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-50 border-b border-surface-100">
      <input
        ref={inputRef}
        className="flex-1 text-sm outline-none bg-transparent text-ink placeholder:text-ink-faint"
        placeholder="Find in document…"
        value={term}
        onChange={e => setTerm(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {term && (
        <span className="text-xs text-ink-muted tabular-nums shrink-0">
          {matchCount === 0 ? 'No results' : `${current} / ${matchCount}`}
        </span>
      )}
      <button
        className="p-0.5 rounded text-ink-muted hover:text-ink hover:bg-surface-100 disabled:opacity-30"
        disabled={matchCount === 0}
        onClick={() => editor.commands.findPrev()}
        title="Previous (Shift+Enter)"
      >
        <ChevronUp className="w-4 h-4" />
      </button>
      <button
        className="p-0.5 rounded text-ink-muted hover:text-ink hover:bg-surface-100 disabled:opacity-30"
        disabled={matchCount === 0}
        onClick={() => editor.commands.findNext()}
        title="Next (Enter)"
      >
        <ChevronDown className="w-4 h-4" />
      </button>
      <button
        className="p-0.5 rounded text-ink-muted hover:text-ink hover:bg-surface-100"
        onClick={handleClose}
        title="Close (Esc)"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
