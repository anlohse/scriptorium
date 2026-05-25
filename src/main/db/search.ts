import { getDb } from './index'

export interface SearchResult {
  id: string
  title: string
  type: 'document' | 'entity'
  subtype: string
  snippet: string
  score: number
}

export function searchAll(query: string): SearchResult[] {
  const db = getDb()
  const results: SearchResult[] = []

  if (!query.trim()) return []

  try {
    const docRows = db.prepare(`
      SELECT d.id, d.title, d.type,
        snippet(documents_fts, 2, '<mark>', '</mark>', '...', 20) as snippet,
        rank as score
      FROM documents_fts
      JOIN documents d ON documents_fts.id = d.id
      WHERE documents_fts MATCH ?
      ORDER BY rank
      LIMIT 50
    `).all(query) as Array<{ id: string; title: string; type: string; snippet: string; score: number }>

    docRows.forEach(row => {
      results.push({ id: row.id, title: row.title, type: 'document', subtype: row.type, snippet: row.snippet || '', score: row.score })
    })
  } catch {}

  try {
    const entityRows = db.prepare(`
      SELECT e.id, e.name as title, e.type,
        snippet(entities_fts, 2, '<mark>', '</mark>', '...', 20) as snippet,
        rank as score
      FROM entities_fts
      JOIN entities e ON entities_fts.id = e.id
      WHERE entities_fts MATCH ?
      ORDER BY rank
      LIMIT 50
    `).all(query) as Array<{ id: string; title: string; type: string; snippet: string; score: number }>

    entityRows.forEach(row => {
      results.push({ id: row.id, title: row.title, type: 'entity', subtype: row.type, snippet: row.snippet || '', score: row.score })
    })
  } catch {}

  return results.sort((a, b) => a.score - b.score)
}

export function searchDocuments(query: string, filters?: { type?: string; volume_id?: string }): SearchResult[] {
  const db = getDb()
  if (!query.trim()) return []

  try {
    let sql = `
      SELECT d.id, d.title, d.type,
        snippet(documents_fts, 2, '<mark>', '</mark>', '...', 20) as snippet,
        rank as score
      FROM documents_fts
      JOIN documents d ON documents_fts.id = d.id
      WHERE documents_fts MATCH ?
    `
    const params: unknown[] = [query]
    if (filters?.type) { sql += ' AND d.type = ?'; params.push(filters.type) }
    if (filters?.volume_id) { sql += ' AND d.volume_id = ?'; params.push(filters.volume_id) }
    sql += ' ORDER BY rank LIMIT 100'

    const rows = db.prepare(sql).all(...params) as Array<{ id: string; title: string; type: string; snippet: string; score: number }>
    return rows.map(row => ({ id: row.id, title: row.title, type: 'document' as const, subtype: row.type, snippet: row.snippet || '', score: row.score }))
  } catch {
    return []
  }
}
