import { getDb } from './index'

export interface SearchResult {
  id: string
  title: string
  type: 'chapter' | 'note' | 'entity'
  subtype: string
  snippet: string
  score: number
}

export type SearchScope = 'all' | 'chapters' | 'notes' | 'entities'

// Escape user input so it's treated as a literal phrase match in FTS5.
function ftsQuery(q: string): string {
  return q.trim().split(/\s+/).filter(Boolean).map(t => `"${t.replace(/"/g, '')}"` ).join(' ')
}

function queryDocuments(fts: string, types: string[]): SearchResult[] {
  const db = getDb()
  const placeholders = types.map(() => '?').join(', ')
  try {
    const rows = db.prepare(`
      SELECT d.id, d.title, d.type,
        snippet(documents_fts, 2, '<mark>', '</mark>', '…', 20) AS snippet,
        rank AS score
      FROM documents_fts
      JOIN documents d ON documents_fts.id = d.id
      WHERE documents_fts MATCH ?
        AND d.type IN (${placeholders})
        AND d.is_folder = 0
      ORDER BY rank
      LIMIT 40
    `).all(fts, ...types) as Array<{ id: string; title: string; type: string; snippet: string; score: number }>
    return rows.map(r => ({
      id: r.id, title: r.title,
      type: (r.type === 'chapter' || r.type === 'scene') ? 'chapter' : 'note',
      subtype: r.type, snippet: r.snippet ?? '', score: r.score
    }))
  } catch {
    return []
  }
}

function queryEntities(fts: string): SearchResult[] {
  const db = getDb()
  try {
    const rows = db.prepare(`
      SELECT e.id, e.name AS title, e.type,
        snippet(entities_fts, -1, '<mark>', '</mark>', '…', 20) AS snippet,
        rank AS score
      FROM entities_fts
      JOIN entities e ON entities_fts.id = e.id
      WHERE entities_fts MATCH ?
        AND e.is_folder = 0
      ORDER BY rank
      LIMIT 40
    `).all(fts) as Array<{ id: string; title: string; type: string; snippet: string; score: number }>
    return rows.map(r => ({ id: r.id, title: r.title, type: 'entity' as const, subtype: r.type, snippet: r.snippet ?? '', score: r.score }))
  } catch {
    return []
  }
}

export function searchQuery(query: string, scope: SearchScope): SearchResult[] {
  if (!query.trim()) return []
  const fts = ftsQuery(query)
  const results: SearchResult[] = []

  if (scope === 'all' || scope === 'chapters') {
    results.push(...queryDocuments(fts, ['chapter', 'scene']))
  }
  if (scope === 'all' || scope === 'notes') {
    results.push(...queryDocuments(fts, ['note', 'lore']))
  }
  if (scope === 'all' || scope === 'entities') {
    results.push(...queryEntities(fts))
  }

  return scope === 'all'
    ? results.sort((a, b) => a.score - b.score).slice(0, 100)
    : results
}
