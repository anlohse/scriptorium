import { getDb } from './index'
import { randomUUID } from 'crypto'

export interface Entity {
  id: string
  name: string
  type: 'character' | 'location' | 'event' | 'faction' | 'item' | 'concept'
  summary: string
  description: string
  tags: string[]
  aliases: string[]
  created_at: string
  updated_at: string
}

export interface Relation {
  id: string
  from_entity_id: string
  to_entity_id: string
  relation_type: string
  created_at: string
}

function parseEntity(row: Record<string, unknown>): Entity {
  return {
    ...row,
    tags: JSON.parse((row.tags as string) || '[]'),
    aliases: JSON.parse((row.aliases as string) || '[]')
  } as Entity
}

export function createEntity(data: Omit<Entity, 'id' | 'created_at' | 'updated_at'>): Entity {
  const db = getDb()
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO entities (id, name, type, summary, description, tags, aliases, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.name, data.type, data.summary, data.description, JSON.stringify(data.tags), JSON.stringify(data.aliases), now, now)

  db.prepare('INSERT INTO entities_fts (id, name, summary, description) VALUES (?, ?, ?, ?)').run(id, data.name, data.summary, data.description)

  return getEntity(id)!
}

export function getEntity(id: string): Entity | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM entities WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? parseEntity(row) : null
}

export function updateEntity(id: string, data: Partial<Omit<Entity, 'id' | 'created_at'>>): Entity | null {
  const db = getDb()
  const now = new Date().toISOString()
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
  const values = Object.values(data).map(v => Array.isArray(v) ? JSON.stringify(v) : v)
  db.prepare(`UPDATE entities SET ${fields}, updated_at = ? WHERE id = ?`).run(...values, now, id)

  const entity = getEntity(id)
  if (entity) {
    db.prepare('DELETE FROM entities_fts WHERE id = ?').run(id)
    db.prepare('INSERT INTO entities_fts (id, name, summary, description) VALUES (?, ?, ?, ?)').run(id, entity.name, entity.summary, entity.description)
  }
  return entity
}

export function deleteEntity(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM entities WHERE id = ?').run(id)
  db.prepare('DELETE FROM entities_fts WHERE id = ?').run(id)
}

export function listEntities(type?: string): Entity[] {
  const db = getDb()
  const rows = type
    ? db.prepare('SELECT * FROM entities WHERE type = ? ORDER BY name ASC').all(type) as Record<string, unknown>[]
    : db.prepare('SELECT * FROM entities ORDER BY name ASC').all() as Record<string, unknown>[]
  return rows.map(parseEntity)
}

export function searchEntitiesByName(query: string): Entity[] {
  const db = getDb()
  const rows = db.prepare("SELECT * FROM entities WHERE name LIKE ? OR aliases LIKE ? ORDER BY name ASC").all(`%${query}%`, `%${query}%`) as Record<string, unknown>[]
  return rows.map(parseEntity)
}

// Relations
export function createRelation(data: Omit<Relation, 'id' | 'created_at'>): Relation {
  const db = getDb()
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare('INSERT INTO relations (id, from_entity_id, to_entity_id, relation_type, created_at) VALUES (?, ?, ?, ?, ?)').run(id, data.from_entity_id, data.to_entity_id, data.relation_type, now)
  return db.prepare('SELECT * FROM relations WHERE id = ?').get(id) as Relation
}

export function deleteRelation(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM relations WHERE id = ?').run(id)
}

export function getEntityRelations(entityId: string): Array<Relation & { from_entity: Entity; to_entity: Entity }> {
  const db = getDb()
  const rows = db.prepare(`
    SELECT r.*,
      fe.id as fe_id, fe.name as fe_name, fe.type as fe_type, fe.summary as fe_summary, fe.description as fe_description, fe.tags as fe_tags, fe.aliases as fe_aliases, fe.created_at as fe_created_at, fe.updated_at as fe_updated_at,
      te.id as te_id, te.name as te_name, te.type as te_type, te.summary as te_summary, te.description as te_description, te.tags as te_tags, te.aliases as te_aliases, te.created_at as te_created_at, te.updated_at as te_updated_at
    FROM relations r
    JOIN entities fe ON r.from_entity_id = fe.id
    JOIN entities te ON r.to_entity_id = te.id
    WHERE r.from_entity_id = ? OR r.to_entity_id = ?
  `).all(entityId, entityId) as Record<string, unknown>[]

  return rows.map(row => ({
    id: row.id as string,
    from_entity_id: row.from_entity_id as string,
    to_entity_id: row.to_entity_id as string,
    relation_type: row.relation_type as string,
    created_at: row.created_at as string,
    from_entity: parseEntity({ id: row.fe_id, name: row.fe_name, type: row.fe_type, summary: row.fe_summary, description: row.fe_description, tags: row.fe_tags, aliases: row.fe_aliases, created_at: row.fe_created_at, updated_at: row.fe_updated_at }),
    to_entity: parseEntity({ id: row.te_id, name: row.te_name, type: row.te_type, summary: row.te_summary, description: row.te_description, tags: row.te_tags, aliases: row.te_aliases, created_at: row.te_created_at, updated_at: row.te_updated_at })
  }))
}
