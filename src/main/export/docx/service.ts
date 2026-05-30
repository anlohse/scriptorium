import { join, dirname } from 'path'
import { mkdirSync, writeFileSync } from 'fs'
import { listDocuments, getDocument, listVolumes } from '../../db/documents'
import { getTranslationByDocLocale } from '../../db/translations'
import { readDocument, readTranslationFile } from '../../fs'
import { htmlToBlocks } from './htmlToBlocks'
import { mdToBlocks } from './mdToBlocks'
import { getProfile } from './profiles'
import { renderDocx } from './renderer'
import type {
  DocxExportRequest,
  DocxExportResult,
  ExportBlock,
  ExportDocument,
  ExportWarning
} from './types'
import type { Document } from '../../db/documents'

function stripFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content
  const end = content.indexOf('\n---', 3)
  if (end === -1) return content
  return content.slice(end + 4).trimStart()
}

function resolveDocPath(projectPath: string, docPath: string): string {
  return docPath.startsWith(projectPath) ? docPath : `${projectPath}${docPath}`
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9 .\-]/g, '').replace(/\s+/g, '-').slice(0, 60) || 'export'
}

async function collectDocs(request: DocxExportRequest, projectPath: string): Promise<Document[]> {
  const { scope } = request
  let docs: Document[] = []

  if (scope.type === 'chapter') {
    const chapter = getDocument(scope.chapterId)
    if (!chapter) throw new Error(`Chapter not found: ${scope.chapterId}`)
    const scenes = listDocuments({ parent_id: scope.chapterId })
    docs = [chapter, ...scenes.filter(d => d.type === 'scene')]

  } else if (scope.type === 'volume') {
    docs = listDocuments({ volume_id: scope.volumeId })
    docs = docs.filter(d => d.type === 'chapter' || d.type === 'scene')
    docs.sort((a, b) => a.sort_order - b.sort_order)

  } else if (scope.type === 'project') {
    docs = listDocuments()
    docs = docs.filter(d => d.type === 'chapter' || d.type === 'scene')
    docs.sort((a, b) => a.sort_order - b.sort_order)

  } else if (scope.type === 'selection') {
    docs = scope.documentIds
      .map(id => getDocument(id))
      .filter((d): d is Document => d !== null)
      .filter(d => d.type === 'chapter' || d.type === 'scene')
  }

  return docs
}

function buildOutputPath(
  projectPath: string,
  request: DocxExportRequest,
  profileName: string
): string {
  const { scope, locale } = request
  let scopePart: string

  if (scope.type === 'volume') {
    const vol = listVolumes().find(v => v.id === scope.volumeId)
    scopePart = `Volume-${sanitize(vol?.title || scope.volumeId)}`
  } else if (scope.type === 'chapter') {
    const chapter = getDocument(scope.chapterId)
    scopePart = `Chapter-${sanitize(chapter?.title || scope.chapterId)}`
  } else if (scope.type === 'project') {
    scopePart = 'Project'
  } else {
    scopePart = 'Selection'
  }

  const localePart = locale ? `-${locale}` : ''
  const filename = `${scopePart}-${sanitize(profileName)}${localePart}.docx`
  return join(projectPath, 'exports', 'docx', filename)
}

function buildExportTitle(request: DocxExportRequest, projectName: string): string {
  const { scope } = request
  if (scope.type === 'project') return projectName
  if (scope.type === 'volume') {
    const vol = listVolumes().find(v => v.id === scope.volumeId)
    return vol ? `${projectName} — ${vol.title}` : projectName
  }
  if (scope.type === 'chapter') {
    const chapter = getDocument(scope.chapterId)
    return chapter ? chapter.title : projectName
  }
  return projectName
}

export async function exportDocx(
  projectPath: string,
  request: DocxExportRequest,
  projectName: string
): Promise<DocxExportResult> {
  const warnings: ExportWarning[] = []

  try {
    const profile = getProfile(request.profileId)
    const docs = await collectDocs(request, projectPath)

    if (docs.length === 0) {
      return { success: false, warnings, error: 'No documents found for the selected scope' }
    }

    const exportDocs: ExportDocument[] = []
    let chapterCount = 0

    for (const doc of docs) {
      let blocks: ExportBlock[]

      if (request.locale) {
        const translation = getTranslationByDocLocale(doc.id, request.locale)
        const hasTranslation = translation && translation.status !== 'untranslated'

        if (hasTranslation && translation) {
          const rawMd = readTranslationFile(translation.path)
          const md = stripFrontmatter(rawMd)
          blocks = mdToBlocks(md, warnings, doc.id)
        } else if (request.fallbackToOriginal) {
          const filePath = resolveDocPath(projectPath, doc.final_path || doc.path)
          const html = readDocument(filePath)
          blocks = htmlToBlocks(html, warnings, doc.id)
        } else {
          continue
        }
      } else {
        const filePath = resolveDocPath(projectPath, doc.final_path || doc.path)
        const html = readDocument(filePath)
        blocks = htmlToBlocks(html, warnings, doc.id)
      }

      if (doc.type === 'chapter' && profile.options.includeChapterNumbers) {
        chapterCount++
        // Prepend a numbered heading if the first block isn't already a heading
        if (blocks.length === 0 || blocks[0].type !== 'heading') {
          blocks.unshift({
            type: 'heading',
            depth: 1,
            children: [{ type: 'text', value: `Chapter ${chapterCount}: ${doc.title}` }]
          })
        } else if (blocks[0].type === 'heading') {
          blocks[0] = {
            ...blocks[0],
            children: [{ type: 'text', value: `Chapter ${chapterCount}: ` }, ...blocks[0].children]
          }
        }
      }

      exportDocs.push({
        id: doc.id,
        title: doc.title,
        docType: doc.type,
        blocks
      })
    }

    if (exportDocs.length === 0) {
      return { success: false, warnings, error: 'No translatable content found' }
    }

    const exportTitle = buildExportTitle(request, projectName)
    const buffer = await renderDocx(
      exportDocs,
      profile,
      projectPath,
      projectName,
      exportTitle,
      request.locale,
      warnings
    )

    const outputPath = buildOutputPath(projectPath, request, profile.name)
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, buffer)

    return { success: true, outputPath, warnings }
  } catch (err) {
    return {
      success: false,
      warnings,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}
