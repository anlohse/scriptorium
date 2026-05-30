import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync, copyFileSync } from 'fs'
import { join, dirname, basename, extname } from 'path'
import { randomUUID } from 'crypto'

export const METADATA_VERSION = 1

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

// ---------------------------------------------------------------------------
// Metadata file: <folder-name>.json
// ---------------------------------------------------------------------------

export function getMetadataFileName(projectPath: string): string {
  return `${basename(projectPath)}.json`
}

export function getMetadataFilePath(projectPath: string): string {
  return join(projectPath, getMetadataFileName(projectPath))
}

export function readMetadata(projectPath: string): ProjectMetadata | null {
  const p = getMetadataFilePath(projectPath)
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as ProjectMetadata
  } catch {
    return null
  }
}

export function writeMetadata(projectPath: string, metadata: ProjectMetadata): void {
  writeFileSync(getMetadataFilePath(projectPath), JSON.stringify(metadata, null, 2), 'utf-8')
}

export function updateMetadata(projectPath: string, updates: Partial<ProjectMetadata>): ProjectMetadata | null {
  const current = readMetadata(projectPath)
  if (!current) return null
  const updated = { ...current, ...updates }
  writeMetadata(projectPath, updated)
  return updated
}

/**
 * Checks whether a folder is a valid Scriptorium project.
 * Accepts both the new <folder>.json format and the legacy project.json.
 */
export function isValidProjectPath(projectPath: string): boolean {
  if (existsSync(getMetadataFilePath(projectPath))) return true
  return existsSync(join(projectPath, 'project.json'))
}

/**
 * If the folder has the legacy project.json but no <folder>.json,
 * creates the new metadata file from the old data and removes project.json.
 * Returns the new metadata, or null if no legacy file exists.
 */
export function migrateLegacyProjectConfig(projectPath: string, appVersion: string): ProjectMetadata | null {
  const legacyPath = join(projectPath, 'project.json')
  if (!existsSync(legacyPath)) return null

  let legacyName = basename(projectPath)
  try {
    const legacy = JSON.parse(readFileSync(legacyPath, 'utf-8'))
    if (legacy.name) legacyName = legacy.name
  } catch { /* ignore parse errors */ }

  // Read current languages if languages.json exists
  let languages: string[] = []
  let defaultLanguage = ''
  const langsPath = join(projectPath, 'languages.json')
  if (existsSync(langsPath)) {
    try {
      const lc = JSON.parse(readFileSync(langsPath, 'utf-8'))
      languages = lc.languages || []
      defaultLanguage = lc.defaultLanguage || ''
    } catch { /* ignore */ }
  }

  const metadata: ProjectMetadata = {
    projectId: randomUUID(),
    projectName: legacyName,
    metadataVersion: METADATA_VERSION,
    // DB already has the full schema from the old initSchema call
    databaseSchemaVersion: 1,
    createdAt: new Date().toISOString(),
    createdWithAppVersion: appVersion,
    lastOpenedWithAppVersion: appVersion,
    defaultLanguage,
    languages,
    paths: {
      database: 'novel.db',
      manuscript: 'manuscript',
      notes: 'notes',
      assets: 'assets',
      exports: 'exports',
      translations: 'translations'
    }
  }

  writeMetadata(projectPath, metadata)
  // Remove legacy file after successful write
  try { unlinkSync(legacyPath) } catch { /* ignore */ }

  return metadata
}

// ---------------------------------------------------------------------------
// Project structure creation
// ---------------------------------------------------------------------------

export function createProjectStructure(projectPath: string, name: string, appVersion: string): ProjectMetadata {
  const dirs = [
    projectPath,
    join(projectPath, 'manuscript'),
    join(projectPath, 'notes'),
    join(projectPath, 'entities'),
    join(projectPath, 'translations'),
    join(projectPath, 'assets', 'characters'),
    join(projectPath, 'assets', 'locations'),
    join(projectPath, 'assets', 'items'),
    join(projectPath, 'assets', 'covers'),
    join(projectPath, 'exports')
  ]
  dirs.forEach(d => mkdirSync(d, { recursive: true }))

  const metadata: ProjectMetadata = {
    projectId: randomUUID(),
    projectName: name,
    metadataVersion: METADATA_VERSION,
    databaseSchemaVersion: 0, // migrations will set this after running
    createdAt: new Date().toISOString(),
    createdWithAppVersion: appVersion,
    lastOpenedWithAppVersion: appVersion,
    defaultLanguage: '',
    languages: [],
    paths: {
      database: 'novel.db',
      manuscript: 'manuscript',
      notes: 'notes',
      assets: 'assets',
      exports: 'exports',
      translations: 'translations'
    }
  }
  writeMetadata(projectPath, metadata)
  return metadata
}

/**
 * Returns true if a directory exists and contains no non-hidden files or folders.
 */
export function isEmptyDirectory(dirPath: string): boolean {
  if (!existsSync(dirPath)) return false
  try {
    const entries = readdirSync(dirPath)
    return entries.filter(e => !e.startsWith('.')).length === 0
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Document files
// ---------------------------------------------------------------------------

export function getDraftPath(finalPath: string): string {
  if (!finalPath || finalPath.startsWith('folder:')) return finalPath
  if (finalPath.endsWith('_draft.md')) return finalPath
  return finalPath.replace(/\.md$/, '_draft.md')
}

export function readDocument(filePath: string): string {
  if (!existsSync(filePath)) return ''
  return readFileSync(filePath, 'utf-8')
}

export function writeDocument(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, content, 'utf-8')
}

export function deleteDocumentFile(filePath: string): void {
  if (existsSync(filePath)) unlinkSync(filePath)
}

export function moveDocument(oldPath: string, newPath: string): void {
  if (!existsSync(oldPath)) return
  mkdirSync(dirname(newPath), { recursive: true })
  copyFileSync(oldPath, newPath)
  unlinkSync(oldPath)
}

export function getDocumentPath(projectPath: string, type: string, volumeTitle: string | null, title: string): string {
  const slug = slugify(title)
  if (type === 'note' || type === 'lore' || type === 'draft') {
    return join(projectPath, 'notes', `${slug}.md`)
  }
  if (volumeTitle) {
    return join(projectPath, 'manuscript', slugify(volumeTitle), `${slug}.md`)
  }
  return join(projectPath, 'manuscript', `${slug}.md`)
}

export function ensureUniqueFilePath(filePath: string): string {
  if (!existsSync(filePath)) return filePath
  const dir = dirname(filePath)
  const ext = extname(filePath)
  const base = basename(filePath, ext)
  let counter = 1
  while (existsSync(join(dir, `${base}-${counter}${ext}`))) counter++
  return join(dir, `${base}-${counter}${ext}`)
}

export function copyAssetToProject(projectPath: string, sourcePath: string, assetType: string): string {
  const ext = extname(sourcePath)
  const destDir = join(projectPath, 'assets', assetType)
  mkdirSync(destDir, { recursive: true })
  const destFilename = `${randomUUID()}${ext}`
  const destPath = join(destDir, destFilename)
  copyFileSync(sourcePath, destPath)
  return destPath
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 80) || 'untitled'
}

// ---------------------------------------------------------------------------
// Entity body files: {projectPath}/entities/{entityId}.md
// ---------------------------------------------------------------------------

export function getEntityBodyPath(projectPath: string, entityId: string): string {
  return join(projectPath, 'entities', `${entityId}.md`)
}

export function readEntityBody(projectPath: string, entityId: string): string {
  const p = getEntityBodyPath(projectPath, entityId)
  if (!existsSync(p)) return ''
  return readFileSync(p, 'utf-8')
}

export function writeEntityBody(projectPath: string, entityId: string, content: string): void {
  mkdirSync(join(projectPath, 'entities'), { recursive: true })
  writeFileSync(getEntityBodyPath(projectPath, entityId), content, 'utf-8')
}

export function deleteEntityBody(projectPath: string, entityId: string): void {
  const p = getEntityBodyPath(projectPath, entityId)
  if (existsSync(p)) unlinkSync(p)
}

// ---------------------------------------------------------------------------
// Translation files: {projectPath}/translations/{locale}/{docRelPath}
// ---------------------------------------------------------------------------

export function ensureTranslationLocale(projectPath: string, locale: string): void {
  mkdirSync(join(projectPath, 'translations', locale), { recursive: true })
}

export function getTranslationFilePath(projectPath: string, locale: string, docRelPath: string): string {
  return join(projectPath, 'translations', locale, docRelPath)
}

export function readTranslationFile(filePath: string): string {
  if (!existsSync(filePath)) return ''
  return readFileSync(filePath, 'utf-8')
}

export function writeTranslationFile(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, content, 'utf-8')
}

export function deleteTranslationFile(filePath: string): void {
  if (existsSync(filePath)) unlinkSync(filePath)
}

export function getDocRelPath(projectPath: string, docPath: string): string {
  const rel = docPath.replace(projectPath, '').replace(/\\/g, '/').replace(/^\//, '')
  return rel.endsWith('.md') ? rel : rel.replace(/\.[^.]+$/, '.md')
}
