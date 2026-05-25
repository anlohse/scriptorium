import Database from 'better-sqlite3'

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK(type IN ('chapter','scene','note','lore','draft')),
      parent_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
      volume_id TEXT,
      sort_order INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]',
      word_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS volumes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('character','location','event','faction','item','concept')),
      summary TEXT DEFAULT '',
      description TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      aliases TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS relations (
      id TEXT PRIMARY KEY,
      from_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      to_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      relation_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mentions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      position INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(document_id, entity_id, position)
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('character','map','concept_art','cover','moodboard','other')),
      title TEXT DEFAULT '',
      description TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
      id UNINDEXED,
      title,
      content,
      content='',
      contentless_delete=1
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
      id UNINDEXED,
      name,
      summary,
      description,
      content='',
      contentless_delete=1
    );

    CREATE TABLE IF NOT EXISTS translations (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      locale TEXT NOT NULL,
      path TEXT NOT NULL,
      status TEXT DEFAULT 'untranslated' CHECK(status IN ('untranslated','draft','in_progress','completed','outdated')),
      source_version INTEGER DEFAULT 0,
      translated_version INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(document_id, locale)
    );

    CREATE INDEX IF NOT EXISTS idx_documents_parent ON documents(parent_id);
    CREATE INDEX IF NOT EXISTS idx_documents_volume ON documents(volume_id);
    CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
    CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
    CREATE INDEX IF NOT EXISTS idx_mentions_document ON mentions(document_id);
    CREATE INDEX IF NOT EXISTS idx_mentions_entity ON mentions(entity_id);
    CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_entity_id);
    CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_entity_id);
    CREATE INDEX IF NOT EXISTS idx_translations_document ON translations(document_id);
    CREATE INDEX IF NOT EXISTS idx_translations_locale ON translations(locale);
  `)
}
