import { Worker } from 'worker_threads'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const BETTER_SQLITE3_PATH: string = require.resolve('better-sqlite3')

// Worker runs in its own thread with its own DB connection so index writes
// never block the main-thread event loop (and therefore never freeze the UI).
const WORKER_SRC = `
const { workerData, parentPort } = require('worker_threads')
const Database = require(workerData.betterSqlitePath)

const db = new Database(workerData.dbPath)
db.pragma('journal_mode = WAL')
db.pragma('busy_timeout = 5000')

const stmts = {
  delDoc:    db.prepare('DELETE FROM documents_fts WHERE id = ?'),
  insDoc:    db.prepare('INSERT INTO documents_fts (id, title, content) VALUES (?, ?, ?)'),
  delEntity: db.prepare('DELETE FROM entities_fts  WHERE id = ?'),
  insEntity: db.prepare('INSERT INTO entities_fts (id, name, summary, description) VALUES (?, ?, ?, ?)'),
}

parentPort.on('message', function(msg) {
  try {
    if (msg.type === 'indexDocument') {
      stmts.delDoc.run(msg.id)
      stmts.insDoc.run(msg.id, msg.title, msg.content)
    } else if (msg.type === 'deleteDocument') {
      stmts.delDoc.run(msg.id)
    } else if (msg.type === 'indexEntity') {
      stmts.delEntity.run(msg.id)
      stmts.insEntity.run(msg.id, msg.name, msg.summary, msg.description)
    } else if (msg.type === 'deleteEntity') {
      stmts.delEntity.run(msg.id)
    }
  } catch(e) {
    console.error('[indexer]', e.message)
  }
})
`

let worker: Worker | null = null

export function startIndexer(dbPath: string): void {
  stopIndexer()
  worker = new Worker(WORKER_SRC, {
    eval: true,
    workerData: { betterSqlitePath: BETTER_SQLITE3_PATH, dbPath }
  })
  worker.on('error', e => console.error('[indexer] worker error:', e))
  worker.unref()
}

export function stopIndexer(): void {
  if (worker) { worker.terminate().catch(() => {}); worker = null }
}

export function queueDocumentIndex(id: string, title: string, content: string): void {
  worker?.postMessage({ type: 'indexDocument', id, title, content })
}

export function queueDocumentDelete(id: string): void {
  worker?.postMessage({ type: 'deleteDocument', id })
}

export function queueEntityIndex(id: string, name: string, summary: string, description: string): void {
  worker?.postMessage({ type: 'indexEntity', id, name, summary, description })
}

export function queueEntityDelete(id: string): void {
  worker?.postMessage({ type: 'deleteEntity', id })
}
