export interface ProjectMetadata {
  projectId: string
  projectName: string
  metadataVersion: number
  databaseSchemaVersion: number
  createdAt: string
  createdWithAppVersion: string
  lastOpenedWithAppVersion: string
  defaultLanguage: string
  languages: string[]
  paths: {
    database: string
    manuscript: string
    notes: string
    assets: string
    exports: string
    translations: string
  }
}

/** @deprecated use ProjectMetadata */
export type ProjectConfig = ProjectMetadata

export interface Document {
  id: string
  title: string
  path: string
  type: 'chapter' | 'scene' | 'note' | 'lore' | 'draft'
  parent_id: string | null
  volume_id: string | null
  sort_order: number
  tags: string[]
  word_count: number
  created_at: string
  updated_at: string
  content?: string
}

export interface Volume {
  id: string
  title: string
  sort_order: number
  created_at: string
  updated_at: string
}

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
  from_entity: Entity
  to_entity: Entity
}

export interface Mention {
  document_id: string
  document_title: string
  document_type: string
  mention_count: number
}

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

export interface SearchResult {
  id: string
  title: string
  type: 'document' | 'entity'
  subtype: string
  snippet: string
  score: number
}

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

export interface LanguageConfig {
  languages: string[]
  defaultLanguage: string
}

export interface EntityFrontmatter {
  type?: string
  aliases?: string[]
  tags?: string[]
  [key: string]: unknown
}

export type SidebarSection = 'manuscript' | 'notes' | 'entities' | 'assets' | 'translations'
export type EntityType = Entity['type']
export type DocumentType = Document['type']
