import { ipcMain, dialog, app } from 'electron'
import { join } from 'path'
import { existsSync, copyFileSync, writeFileSync } from 'fs'
import { openDb, closeDb } from '../db'
import { runMigrations, CURRENT_SCHEMA_VERSION } from '../db/migrations'
import { listDocuments, updateDocument } from '../db/documents'
import {
  createProjectStructure,
  readMetadata,
  updateMetadata,
  migrateLegacyProjectConfig,
  isEmptyDirectory,
  getMetadataFilePath,
  isValidProjectPath,
  getDraftPath,
  ProjectMetadata
} from '../fs'
import { startIndexer, stopIndexer } from '../search/indexer'

let currentProjectPath: string | null = null

export function getCurrentProjectPath(): string | null {
  return currentProjectPath
}

// ---------------------------------------------------------------------------
// Core open logic — shared by open and openDialog
// ---------------------------------------------------------------------------

type OpenResult =
  | { success: true; projectPath: string; config: ProjectMetadata }
  | { success: false; error: string }
  | { canceled: true }

async function openProjectAtPath(projectPath: string, allowCreate = false): Promise<OpenResult> {
  const appVersion = app.getVersion()

  // 1. Check for metadata file
  let metadata = readMetadata(projectPath)

  if (!metadata) {
    // Check for legacy project.json and auto-migrate
    const migrated = migrateLegacyProjectConfig(projectPath, appVersion)
    if (migrated) {
      metadata = migrated
    } else if (allowCreate) {
      // No metadata, folder may be empty — offer to create
      if (isEmptyDirectory(projectPath)) {
        const { response } = await dialog.showMessageBox({
          type: 'question',
          title: 'Create Project',
          message: 'This folder does not contain a project. Do you want to create a new project here?',
          buttons: ['Yes', 'No'],
          defaultId: 0,
          cancelId: 1
        })
        if (response !== 0) return { canceled: true }

        // Create project using folder name as project name
        const { basename } = await import('path')
        const name = basename(projectPath)
        metadata = createProjectStructure(projectPath, name, appVersion)
      } else {
        return {
          success: false,
          error: 'This folder is not empty and does not contain a valid project metadata file. A new project cannot be created here.'
        }
      }
    } else {
      return { success: false, error: 'Not a valid Scriptorium project' }
    }
  }

  // 2. Validate required metadata fields
  if (!metadata.projectId || !metadata.projectName) {
    return { success: false, error: 'The metadata file is missing required fields.' }
  }

  // 3. Verify the database file is reachable
  const dbPath = join(projectPath, metadata.paths?.database ?? 'novel.db')
  const dbExists = existsSync(dbPath)

  // 4. Database schema version check
  const projectVersion = metadata.databaseSchemaVersion ?? 0

  if (projectVersion > CURRENT_SCHEMA_VERSION) {
    return {
      success: false,
      error: `This project was created or updated by a newer version of the application (schema v${projectVersion}). Please update Scriptorium before opening this project.`
    }
  }

  // 5. Open DB and run pending migrations
  const db = openDb(projectPath)

  if (!dbExists || projectVersion < CURRENT_SCHEMA_VERSION) {
    let newVersion = projectVersion
    try {
      newVersion = runMigrations(db, projectVersion)
    } catch (err) {
      stopIndexer()
      closeDb()
      currentProjectPath = null
      return { success: false, error: `Migration failed: ${(err as Error).message}` }
    }

    // After migration v3: create draft files for existing chapters/scenes
    if (projectVersion < 3 && newVersion >= 3) {
      migrateDocumentFilesToDraftFinal(projectPath)
    }

    // Update metadata only after successful migration
    const updated = updateMetadata(projectPath, {
      databaseSchemaVersion: newVersion,
      lastOpenedWithAppVersion: appVersion
    })
    metadata = updated ?? metadata
  }

  currentProjectPath = projectPath
  startIndexer(join(projectPath, metadata.paths?.database ?? 'novel.db'))
  return { success: true, projectPath, config: metadata }
}

// ---------------------------------------------------------------------------
// Draft/final file migration for existing chapters and scenes
// ---------------------------------------------------------------------------

function migrateDocumentFilesToDraftFinal(projectPath: string): void {
  const docs = listDocuments()
  for (const doc of docs) {
    if ((doc.type === 'chapter' || doc.type === 'scene') && !doc.is_folder && !doc.draft_path) {
      const finalPath = doc.path
      const draftPath = getDraftPath(finalPath)
      const absFinal = finalPath.startsWith(projectPath) ? finalPath : `${projectPath}${finalPath}`
      const absDraft = draftPath.startsWith(projectPath) ? draftPath : `${projectPath}${draftPath}`

      // Copy existing content into the draft file
      if (!existsSync(absDraft)) {
        if (existsSync(absFinal)) {
          copyFileSync(absFinal, absDraft)
        } else {
          writeFileSync(absDraft, '', 'utf-8')
        }
      }

      updateDocument(doc.id, {
        draft_path: draftPath,
        final_path: finalPath,
        show_draft: 1,
        completed: 0
      })
    }
  }
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

export function registerProjectHandlers(): void {
  ipcMain.handle('project:create', async (_event, name: string, parentDir: string) => {
    const appVersion = app.getVersion()
    const { join: pjoin } = await import('path')
    const projectPath = pjoin(parentDir, name.replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase())

    const metadata = createProjectStructure(projectPath, name, appVersion, app.getLocale())
    const db = openDb(projectPath)
    const newVersion = runMigrations(db, 0)
    const config = updateMetadata(projectPath, { databaseSchemaVersion: newVersion }) ?? metadata
    currentProjectPath = projectPath
    startIndexer(join(projectPath, 'novel.db'))
    return { success: true, projectPath, config }
  })

  ipcMain.handle('project:open', async (_event, projectPath: string) => {
    return openProjectAtPath(projectPath, false)
  })

  ipcMain.handle('project:openDialog', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open Project',
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return { canceled: true }
    return openProjectAtPath(result.filePaths[0], true)
  })

  ipcMain.handle('project:createDialog', async (_event, name: string) => {
    const appVersion = app.getVersion()
    const result = await dialog.showOpenDialog({
      title: 'Choose Project Location',
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return { canceled: true }

    const { join: pjoin } = await import('path')
    const parentDir = result.filePaths[0]
    const projectPath = pjoin(parentDir, name.replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase())

    const metadata = createProjectStructure(projectPath, name, appVersion, app.getLocale())
    const db = openDb(projectPath)
    const newVersion = runMigrations(db, 0)
    const config = updateMetadata(projectPath, { databaseSchemaVersion: newVersion }) ?? metadata
    currentProjectPath = projectPath
    startIndexer(join(projectPath, 'novel.db'))
    return { success: true, projectPath, config }
  })

  ipcMain.handle('project:close', async () => {
    stopIndexer()
    closeDb()
    currentProjectPath = null
    return { success: true }
  })

  ipcMain.handle('project:getCurrent', () => {
    if (!currentProjectPath) return null
    const config = readMetadata(currentProjectPath)
    return config ? { projectPath: currentProjectPath, config } : null
  })

  ipcMain.handle('project:update', async (_event, data: { name?: string }) => {
    if (!currentProjectPath) return { success: false }
    const updates: Partial<ProjectMetadata> = {}
    if (data.name) updates.projectName = data.name
    const config = updateMetadata(currentProjectPath, updates)
    return { success: true, config }
  })

  ipcMain.handle('project:getDefaultDir', () => {
    return app.getPath('documents')
  })

  // Languages stored in project metadata
  ipcMain.handle('project:getLanguages', () => {
    if (!currentProjectPath) return null
    const meta = readMetadata(currentProjectPath)
    if (!meta) return { languages: [], defaultLanguage: '' }
    return { languages: meta.languages ?? [], defaultLanguage: meta.defaultLanguage ?? '' }
  })

  ipcMain.handle('project:setLanguages', (_event, languages: string[], defaultLanguage: string) => {
    if (!currentProjectPath) return { success: false }
    updateMetadata(currentProjectPath, { languages, defaultLanguage })
    return { success: true }
  })
}
