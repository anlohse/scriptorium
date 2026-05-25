import { getDb } from './index'
import { randomUUID } from 'crypto'

export interface Asset {
  id: string
  path: string
  type: 'character' | 'map' | 'concept_art' | 'cover' | 'moodboard' | 'other'
  title: string
  description: string
  tags: string[]
  entity_id: string | null
  created_at: string
  updated_at: string
}

function parseAsset(row: Record<string, unknown>): Asset {
  return { ...row, tags: JSON.parse((row.tags as string) || '[]') } as Asset
}

export function createAsset(data: Omit<Asset, 'id' | 'created_at' | 'updated_at'>): Asset {
  const db = getDb()
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare('INSERT INTO assets (id, path, type, title, description, tags, entity_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, data.path, data.type, data.title, data.description, JSON.stringify(data.tags), data.entity_id, now, now)
  return getAsset(id)!
}

export function getAsset(id: string): Asset | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? parseAsset(row) : null
}

export function updateAsset(id: string, data: Partial<Omit<Asset, 'id' | 'created_at'>>): Asset | null {
  const db = getDb()
  const now = new Date().toISOString()
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
  const values = Object.values(data).map(v => Array.isArray(v) ? JSON.stringify(v) : v)
  db.prepare(`UPDATE assets SET ${fields}, updated_at = ? WHERE id = ?`).run(...values, now, id)
  return getAsset(id)
}

export function deleteAsset(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM assets WHERE id = ?').run(id)
}

export function listAssets(filters?: { type?: string; entity_id?: string }): Asset[] {
  const db = getDb()
  let query = 'SELECT * FROM assets WHERE 1=1'
  const params: unknown[] = []
  if (filters?.type) { query += ' AND type = ?'; params.push(filters.type) }
  if (filters?.entity_id) { query += ' AND entity_id = ?'; params.push(filters.entity_id) }
  query += ' ORDER BY created_at DESC'
  const rows = db.prepare(query).all(...params) as Record<string, unknown>[]
  return rows.map(parseAsset)
}
