import { getDb } from './index'
import { randomUUID } from 'crypto'

export interface Mention {
  id: string
  document_id: string
  entity_id: string
  position: number
  created_at: string
}

export function syncMentions(documentId: string, entityIds: string[]): void {
  const db = getDb()
  db.prepare('DELETE FROM mentions WHERE document_id = ?').run(documentId)
  const now = new Date().toISOString()
  const insert = db.prepare('INSERT OR IGNORE INTO mentions (id, document_id, entity_id, position, created_at) VALUES (?, ?, ?, ?, ?)')
  entityIds.forEach((entityId, index) => {
    insert.run(randomUUID(), documentId, entityId, index, now)
  })
}

export function getMentionsByDocument(documentId: string): Mention[] {
  const db = getDb()
  return db.prepare('SELECT * FROM mentions WHERE document_id = ? ORDER BY position ASC').all(documentId) as Mention[]
}

export function getMentionsByEntity(entityId: string): Array<{
  document_id: string
  document_title: string
  document_type: string
  mention_count: number
}> {
  const db = getDb()
  return db.prepare(`
    SELECT m.document_id, d.title as document_title, d.type as document_type, COUNT(*) as mention_count
    FROM mentions m
    JOIN documents d ON m.document_id = d.id
    WHERE m.entity_id = ?
    GROUP BY m.document_id
    ORDER BY d.title ASC
  `).all(entityId) as Array<{ document_id: string; document_title: string; document_type: string; mention_count: number }>
}

export function getEntityMentionStats(): Array<{ entity_id: string; mention_count: number; document_count: number }> {
  const db = getDb()
  return db.prepare(`
    SELECT entity_id, COUNT(*) as mention_count, COUNT(DISTINCT document_id) as document_count
    FROM mentions
    GROUP BY entity_id
    ORDER BY mention_count DESC
  `).all() as Array<{ entity_id: string; mention_count: number; document_count: number }>
}
