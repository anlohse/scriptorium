import React, { useState, useEffect, useRef } from 'react'
import { Search, X, FileText, BookOpen, StickyNote, Users } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import type { SearchResult, SearchScope } from '../../types'

const TABS: { scope: SearchScope; label: string }[] = [
  { scope: 'all',      label: 'All'      },
  { scope: 'chapters', label: 'Chapters' },
  { scope: 'notes',    label: 'Notes'    },
  { scope: 'entities', label: 'Entities' }
]

function ResultIcon({ type }: { type: SearchResult['type'] }): React.ReactElement {
  if (type === 'entity') return <Users className="w-4 h-4 text-accent shrink-0" />
  if (type === 'chapter') return <BookOpen className="w-4 h-4 text-ink-muted shrink-0" />
  return <StickyNote className="w-4 h-4 text-ink-muted shrink-0" />
}

export function SearchPanel(): React.ReactElement {
  const { closeSearch, setActiveDocument, setActiveEntity, setInspectorOpen } = useUIStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [scope, setScope] = useState<SearchScope>('all')
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); setLoading(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const res = await window.api.search.query(query, scope)
      setResults(res)
      setLoading(false)
    }, 300)
  }, [query, scope])

  const handleSelect = (result: SearchResult): void => {
    if (result.type === 'entity') {
      setActiveEntity(result.id)
      setInspectorOpen(true)
    } else {
      setActiveDocument(result.id)
    }
    closeSearch()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-16 z-50" onClick={closeSearch}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-100">
          <Search className="w-4 h-4 text-ink-muted shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 text-sm outline-none bg-transparent text-ink placeholder:text-ink-faint"
            placeholder="Search chapters, notes, entities…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && closeSearch()}
          />
          {query && (
            <button className="text-ink-muted hover:text-ink" onClick={() => { setQuery(''); setResults([]) }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Scope tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-surface-100">
          {TABS.map(t => (
            <button
              key={t.scope}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${scope === t.scope ? 'bg-accent text-white' : 'text-ink-muted hover:bg-surface-100'}`}
              onClick={() => setScope(t.scope)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="px-4 py-6 text-center text-sm text-ink-muted">Searching…</div>
          )}
          {!loading && query && results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-ink-muted">No results for "{query}"</div>
          )}
          {!loading && !query && (
            <div className="px-4 py-6 text-center text-sm text-ink-muted flex flex-col items-center gap-1">
              <FileText className="w-8 h-8 text-ink-faint mb-1" />
              <span>Search across your project</span>
              <span className="text-xs text-ink-faint">Chapters, notes and entities</span>
            </div>
          )}
          {!loading && results.map(result => (
            <button
              key={`${result.type}-${result.id}`}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-50 border-b border-surface-50 text-left"
              onClick={() => handleSelect(result)}
            >
              <div className="mt-0.5"><ResultIcon type={result.type} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink truncate">{result.title}</div>
                <div className="text-xs text-ink-muted capitalize">{result.type} · {result.subtype}</div>
                {result.snippet && (
                  <div
                    className="text-xs text-ink-muted mt-0.5 line-clamp-2 [&_mark]:bg-yellow-100 [&_mark]:text-ink"
                    dangerouslySetInnerHTML={{ __html: result.snippet }}
                  />
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="px-4 py-2 bg-surface-50 text-xs text-ink-faint flex items-center gap-3">
          <span>↵ select</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  )
}
