import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface SpellMenuState {
  word: string
  suggestions: string[]
  from: number
  to: number
  rect: DOMRect
}

interface Props {
  state: SpellMenuState
  onAccept: (suggestion: string, from: number, to: number) => void
  onIgnore: (word: string) => void
  onAddToDictionary: (word: string) => void
  onClose: () => void
}

export function SpellCheckMenu({ state, onAccept, onIgnore, onAddToDictionary, onClose }: Props): React.ReactElement {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close when clicking outside the menu
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler, true)
    return () => document.removeEventListener('mousedown', handler, true)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [onClose])

  // Position below the word, clamped to viewport
  const top = Math.min(state.rect.bottom + 4, window.innerHeight - 160)
  const left = Math.min(state.rect.left, window.innerWidth - 180)

  return createPortal(
    <div
      ref={menuRef}
      style={{ position: 'fixed', top, left, zIndex: 9999, minWidth: 160 }}
      className="bg-white border border-surface-200 rounded-md shadow-xl py-1 text-sm"
      onMouseDown={e => e.stopPropagation()}
    >
      {state.suggestions.length > 0 ? (
        <>
          {state.suggestions.map(s => (
            <button
              key={s}
              className="w-full text-left px-3 py-1.5 hover:bg-surface-100 text-ink font-medium"
              onClick={() => { onAccept(s, state.from, state.to); onClose() }}
            >
              {s}
            </button>
          ))}
          <div className="my-1 border-t border-surface-100" />
        </>
      ) : (
        <div className="px-3 py-1.5 text-ink-muted italic">No suggestions</div>
      )}
      <button
        className="w-full text-left px-3 py-1.5 hover:bg-surface-100 text-ink-muted"
        onClick={() => { onIgnore(state.word); onClose() }}
      >
        Ignore
      </button>
      <button
        className="w-full text-left px-3 py-1.5 hover:bg-surface-100 text-ink-muted"
        onClick={() => { onAddToDictionary(state.word); onClose() }}
      >
        Add to dictionary
      </button>
    </div>,
    document.body
  )
}
