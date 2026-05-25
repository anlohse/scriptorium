import { getDb } from './index'
import { randomUUID } from 'crypto'

export type TranslationStatus = 'untranslated' | 'draft' | 'in_progress' | 'completed' | 'outdated'

export interface Translation {
  id: string
  document_id: string
  locale: string
  path: string
  status: TranslationStatus
  source_version: number
  translated_version: number
  created_at: string
  updated_at: string
}

export function createTranslation(data: Omit<Translation, 'id' | 'created_at' | 'updated_at'>): Translation {
  const db = getDb()
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO translations (id, document_id, locale, path, status, source_version, translated_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.document_id, data.locale, data.path, data.status || 'untranslated', data.source_version || 0, data.translated_version || 0, now, now)
  return db.prepare('SELECT * FROM translations WHERE id = ?').get(id) as Translation
}

export function getTranslation(id: string): Translation | null {
  const db = getDb()
  return db.prepare('SELECT * FROM translations WHERE id = ?').get(id) as Translation | null
}

export function getTranslationByDocLocale(documentId: string, locale: string): Translation | null {
  const db = getDb()
  return db.prepare('SELECT * FROM translations WHERE document_id = ? AND locale = ?').get(documentId, locale) as Translation | null
}

export function listTranslations(documentId?: string): Translation[] {
  const db = getDb()
  if (documentId) {
    return db.prepare('SELECT * FROM translations WHERE document_id = ? ORDER BY locale ASC').all(documentId) as Translation[]
  }
  return db.prepare('SELECT * FROM translations ORDER BY locale ASC').all() as Translation[]
}

export function updateTranslation(id: string, data: Partial<Omit<Translation, 'id' | 'created_at'>>): Translation | null {
  const db = getDb()
  const now = new Date().toISOString()
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
  const values = Object.values(data)
  db.prepare(`UPDATE translations SET ${fields}, updated_at = ? WHERE id = ?`).run(...values, now, id)
  return getTranslation(id)
}

export function deleteTranslation(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM translations WHERE id = ?').run(id)
}

export function listLocales(): string[] {
  const db = getDb()
  const rows = db.prepare('SELECT DISTINCT locale FROM translations ORDER BY locale ASC').all() as { locale: string }[]
  return rows.map(r => r.locale)
}

export function markTranslationsOutdated(documentId: string): void {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(`
    UPDATE translations SET status = 'outdated', updated_at = ?
    WHERE document_id = ? AND status = 'completed'
  `).run(now, documentId)
}
