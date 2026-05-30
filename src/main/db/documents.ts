import { getDb } from './index'
import { randomUUID } from 'crypto'

export interface Document {
  id: string
  title: string
  path: string
  type: 'chapter' | 'scene' | 'note' | 'lore' | 'draft'
  parent_id: string | null
  volume_id: string | null
  sort_order: number
  is_folder: number
  draft_path: string | null
  final_path: string | null
  show_draft: number
  completed: number
  tags: string[]
  word_count: number
  created_at: string
  updated_at: string
}

export interface Volume {
  id: string
  title: string
  sort_order: number
  created_at: string
  updated_at: string
}

function parseDocument(row: Record<string, unknown>): Document {
  return {
    ...row,
    tags: JSON.parse((row.tags as string) || '[]')
  } as Document
}

// Documents
export function createDocument(data: Omit<Document, 'id' | 'created_at' | 'updated_at'>): Document {
  const db = getDb()
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO documents (id, title, path, type, parent_id, volume_id, sort_order, is_folder, draft_path, final_path, show_draft, completed, tags, word_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.title, data.path, data.type, data.parent_id, data.volume_id, data.sort_order, data.is_folder ?? 0, data.draft_path ?? null, data.final_path ?? null, data.show_draft ?? 1, data.completed ?? 0, JSON.stringify(data.tags), data.word_count, now, now)
  return getDocument(id)!
}

export function getDocument(id: string): Document | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? parseDocument(row) : null
}

export function getDocumentByPath(path: string): Document | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM documents WHERE path = ?').get(path) as Record<string, unknown> | undefined
  return row ? parseDocument(row) : null
}

export function updateDocument(id: string, data: Partial<Omit<Document, 'id' | 'created_at'>>): Document | null {
  const db = getDb()
  const now = new Date().toISOString()
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
  const values = Object.values(data).map(v => Array.isArray(v) ? JSON.stringify(v) : v)
  db.prepare(`UPDATE documents SET ${fields}, updated_at = ? WHERE id = ?`).run(...values, now, id)
  return getDocument(id)
}

export function deleteDocument(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM documents WHERE id = ?').run(id)
  db.prepare('DELETE FROM documents_fts WHERE id = ?').run(id)
}

export function listDocuments(filters?: { volume_id?: string; type?: string; parent_id?: string | null }): Document[] {
  const db = getDb()
  let query = 'SELECT * FROM documents WHERE 1=1'
  const params: unknown[] = []
  if (filters?.volume_id) { query += ' AND volume_id = ?'; params.push(filters.volume_id) }
  if (filters?.type) { query += ' AND type = ?'; params.push(filters.type) }
  if (filters?.parent_id !== undefined) {
    if (filters.parent_id === null) { query += ' AND parent_id IS NULL' }
    else { query += ' AND parent_id = ?'; params.push(filters.parent_id) }
  }
  query += ' ORDER BY sort_order ASC, created_at ASC'
  const rows = db.prepare(query).all(...params) as Record<string, unknown>[]
  return rows.map(parseDocument)
}

export function indexDocumentContent(id: string, title: string, content: string): void {
  const db = getDb()
  db.prepare('DELETE FROM documents_fts WHERE id = ?').run(id)
  db.prepare('INSERT INTO documents_fts (id, title, content) VALUES (?, ?, ?)').run(id, title, content)
}

export function updateDocumentWordCount(id: string, content: string): void {
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0
  const db = getDb()
  db.prepare('UPDATE documents SET word_count = ?, updated_at = ? WHERE id = ?').run(wordCount, new Date().toISOString(), id)
}

// Volumes
export function createVolume(data: Omit<Volume, 'id' | 'created_at' | 'updated_at'>): Volume {
  const db = getDb()
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare('INSERT INTO volumes (id, title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, data.title, data.sort_order, now, now)
  return db.prepare('SELECT * FROM volumes WHERE id = ?').get(id) as Volume
}

export function listVolumes(): Volume[] {
  const db = getDb()
  return db.prepare('SELECT * FROM volumes ORDER BY sort_order ASC, created_at ASC').all() as Volume[]
}

export function updateVolume(id: string, data: Partial<Omit<Volume, 'id' | 'created_at'>>): Volume {
  const db = getDb()
  const now = new Date().toISOString()
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
  const values = Object.values(data)
  db.prepare(`UPDATE volumes SET ${fields}, updated_at = ? WHERE id = ?`).run(...values, now, id)
  return db.prepare('SELECT * FROM volumes WHERE id = ?').get(id) as Volume
}

export function deleteVolume(id: string): void {
  const db = getDb()
  db.prepare('UPDATE documents SET volume_id = NULL WHERE volume_id = ?').run(id)
  db.prepare('DELETE FROM volumes WHERE id = ?').run(id)
}
