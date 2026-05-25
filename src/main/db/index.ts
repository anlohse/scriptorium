import Database from 'better-sqlite3'
import { join } from 'path'

let db: Database.Database | null = null
let currentDbPath: string | null = null

export function openDb(projectPath: string): Database.Database {
  const dbPath = join(projectPath, 'novel.db')
  if (db && currentDbPath === dbPath) return db

  if (db) db.close()

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  currentDbPath = dbPath

  return db
}

export function getDb(): Database.Database {
  if (!db) throw new Error('No project is open. Call openDb first.')
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
    currentDbPath = null
  }
}

export function isDbOpen(): boolean {
  return db !== null
}
