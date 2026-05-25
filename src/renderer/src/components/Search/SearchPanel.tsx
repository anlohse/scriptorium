import React, { useState, useEffect, useRef } from 'react'
import { Search, X, FileText, Users } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import type { SearchResult } from '../../types'

export function SearchPanel(): React.ReactElement {
  const { closeSearch, setActiveDocument, setActiveEntity, setInspectorOpen } = useUIStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'document' | 'entity'>('all')
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const res = await window.api.search.all(query)
      setResults(res)
      setLoading(false)
    }, 300)
  }, [query])

  const filtered = filter === 'all' ? results : results.filter(r => r.type === filter)

  const handleSelect = (result: SearchResult): void => {
    if (result.type === 'document') {
      setActiveDocument(result.id)
    } else {
      setActiveEntity(result.id)
      setInspectorOpen(true)
    }
    closeSearch()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-16 z-50" onClick={closeSearch}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-100">
          <Search className="w-4 h-4 text-ink-muted shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 text-sm outline-none bg-transparent text-ink placeholder:text-ink-faint"
            placeholder="Search documents, entities, lore..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && closeSearch()}
          />
          {query && (
            <button className="text-ink-muted hover:text-ink" onClick={() => setQuery('')}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-1 px-4 py-2 border-b border-surface-100">
          {(['all', 'document', 'entity'] as const).map(f => (
            <button
              key={f}
              className={`text-xs px-2.5 py-1 rounded-full capitalize transition-colors ${filter === f ? 'bg-accent text-white' : 'text-ink-muted hover:bg-surface-100'}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'document' ? 'Documents' : 'Entities'}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="px-4 py-6 text-center text-sm text-ink-muted">Searching...</div>
          )}
          {!loading && query && filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-ink-muted">No results for "{query}"</div>
          )}
          {!loading && !query && (
            <div className="px-4 py-6 text-center text-sm text-ink-muted">Type to search across your project</div>
          )}
          {!loading && filtered.map(result => (
            <div
              key={`${result.type}-${result.id}`}
              className="flex items-start gap-3 px-4 py-3 hover:bg-surface-50 cursor-pointer border-b border-surface-50"
              onClick={() => handleSelect(result)}
            >
              <div className="mt-0.5 shrink-0">
                {result.type === 'entity'
                  ? <Users className="w-4 h-4 text-accent" />
                  : <FileText className="w-4 h-4 text-ink-muted" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink">{result.title}</div>
                <div className="text-xs text-ink-muted capitalize">{result.type} · {result.subtype}</div>
                {result.snippet && (
                  <div
                    className="text-xs text-ink-muted mt-0.5 line-clamp-2"
                    dangerouslySetInnerHTML={{ __html: result.snippet }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-2 bg-surface-50 text-xs text-ink-faint flex items-center gap-3">
          <span>↵ to select</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  )
}
