import { ipcMain, dialog } from 'electron'
import { join } from 'path'
import { writeFileSync, mkdirSync } from 'fs'
import { getCurrentProjectPath } from './project'
import { listDocuments } from '../db/documents'
import { getTranslationByDocLocale } from '../db/translations'
import { readDocument, readTranslationFile, readMetadata } from '../fs'
import { exportDocx } from '../export/docx/service'
import type { DocxExportRequest } from '../export/docx/types'

export interface ExportProfile {
  name: string
  format: 'markdown' | 'html'
  scope: 'project' | 'volume' | 'chapter'
  volume_id?: string
  document_ids?: string[]
  includeTitle: boolean
  chapterNumbering: boolean
  locale?: string
  fallbackToOriginal?: boolean
}

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<div[^>]*data-type=["']page-break["'][^>]*>.*?<\/div>/gis, '{{page-break}}\n\n')
    .replace(/<h1[^>]*>(.*?)<\/h1>/gis, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gis, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gis, '### $1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gis, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gis, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gis, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gis, '*$1*')
    .replace(/<strike[^>]*>(.*?)<\/strike>/gis, '~~$1~~')
    .replace(/<del[^>]*>(.*?)<\/del>/gis, '~~$1~~')
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, '> $1\n\n')
    .replace(/<hr[^>]*\/?>/gi, '\n---\n\n')
    .replace(/<br[^>]*\/?>/gi, '\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gis, '- $1\n')
    .replace(/<\/?(ul|ol|div|section)[^>]*>/gi, '\n')
    .replace(/<span[^>]*class="mention"[^>]*>(.*?)<\/span>/gi, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripPageBreaks(html: string): string {
  return html.replace(/<div[^>]*data-type=["']page-break["'][^>]*>.*?<\/div>/gis, '')
}

function stripMentionTags(html: string): string {
  return html.replace(/<span[^>]*class="mention"[^>]*>([^<]+)<\/span>/g, '$1')
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content
  const end = content.indexOf('\n---', 3)
  if (end === -1) return content
  return content.slice(end + 4).trimStart()
}

// Convert prose Markdown to HTML (covers common novel-writing markup)
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---+$/gm, '<hr>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .split(/\n{2,}/)
    .map(block => {
      block = block.trim()
      if (!block) return ''
      if (/^<(h[1-3]|ul|ol|li|hr|blockquote)/.test(block)) return block
      return `<p>${block.replace(/\n/g, '<br>')}</p>`
    })
    .filter(Boolean)
    .join('\n')
}

function buildSection(html: string, isOriginalFallback: boolean, docType: string, chapterCount: number, profile: ExportProfile): string {
  if (profile.format === 'html') {
    let section = stripPageBreaks(stripMentionTags(html))
    if (profile.chapterNumbering && docType === 'chapter') {
      section = `<h2>Chapter ${chapterCount}</h2>` + section.replace(/<h1[^>]*>.*?<\/h1>/i, '')
    }
    if (isOriginalFallback) section = `<p><em>[Original — no translation available]</em></p>` + section
    return section
  } else {
    let md = htmlToMarkdown(html)
    if (profile.chapterNumbering && docType === 'chapter') {
      md = `## Chapter ${chapterCount}\n\n` + md.replace(/^#\s+.*\n+/, '')
    }
    if (isOriginalFallback) md = `*[Original — no translation available]*\n\n` + md
    return md
  }
}

function buildTranslationSection(md: string, docType: string, chapterCount: number, profile: ExportProfile): string {
  if (profile.format === 'html') {
    let html = markdownToHtml(md)
    if (profile.chapterNumbering && docType === 'chapter') {
      html = `<h2>Chapter ${chapterCount}</h2>` + html.replace(/<h1[^>]*>.*?<\/h1>/i, '')
    }
    return html
  } else {
    if (profile.chapterNumbering && docType === 'chapter') {
      return `## Chapter ${chapterCount}\n\n` + md.replace(/^#\s+.*\n+/, '')
    }
    return md
  }
}

export function registerExportHandlers(): void {
  ipcMain.handle('export:docx', async (_event, request: DocxExportRequest) => {
    const projectPath = getCurrentProjectPath()
    if (!projectPath) return { success: false, warnings: [], error: 'No project open' }
    const metadata = readMetadata(projectPath)
    const projectName = metadata?.projectName || 'Untitled'
    return exportDocx(projectPath, request, projectName)
  })

  ipcMain.handle('export:run', async (_event, profile: ExportProfile) => {
    const projectPath = getCurrentProjectPath()
    if (!projectPath) return { success: false, error: 'No project open' }

    const result = await dialog.showSaveDialog({
      title: 'Export',
      defaultPath: join(projectPath, 'exports', `export.${profile.format === 'html' ? 'html' : 'md'}`),
      filters: profile.format === 'html'
        ? [{ name: 'HTML', extensions: ['html'] }]
        : [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (result.canceled || !result.filePath) return { canceled: true }

    let documents = listDocuments(
      profile.scope === 'volume' && profile.volume_id
        ? { volume_id: profile.volume_id }
        : undefined
    )

    if (profile.document_ids?.length) {
      documents = documents.filter(d => profile.document_ids!.includes(d.id))
    }

    documents = documents.filter(d => d.type === 'chapter' || d.type === 'scene')
    documents.sort((a, b) => a.sort_order - b.sort_order)

    const sections: string[] = []
    let chapterCount = 0

    for (const doc of documents) {
      if (doc.type === 'chapter') chapterCount++

      let sectionContent: string

      if (profile.locale) {
        // Translation export: read the translation file for this doc+locale
        const translation = getTranslationByDocLocale(doc.id, profile.locale)
        const hasTranslation = translation && translation.status !== 'untranslated'

        if (!hasTranslation) {
          if (!profile.fallbackToOriginal) continue  // skip untranslated docs
          // Fall back to original HTML — always use final for export
          const finalOrPath = doc.final_path || doc.path
          const filePath = finalOrPath.startsWith(projectPath) ? finalOrPath : `${projectPath}${finalOrPath}`
          const html = readDocument(filePath)
          sectionContent = buildSection(html, true, doc.type, chapterCount, profile)
        } else {
          // Read translation Markdown file
          const rawMd = readTranslationFile(translation.path)
          const md = stripFrontmatter(rawMd)
          sectionContent = buildTranslationSection(md, doc.type, chapterCount, profile)
        }
      } else {
        // Original export — always use final_path for chapters/scenes
        const finalOrPath = doc.final_path || doc.path
        const filePath = finalOrPath.startsWith(projectPath) ? finalOrPath : `${projectPath}${finalOrPath}`
        const html = readDocument(filePath)
        sectionContent = buildSection(html, false, doc.type, chapterCount, profile)
      }

      sections.push(sectionContent)
    }

    mkdirSync(join(projectPath, 'exports'), { recursive: true })

    if (profile.format === 'html') {
      const combined = sections.join('\n<hr>\n')
      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Export</title>
  <style>
    body { max-width: 70ch; margin: 4rem auto; font-family: Georgia, serif; line-height: 1.7; color: #1a1410; padding: 0 2rem; }
    h1, h2, h3 { font-family: inherit; }
    hr { border: none; border-top: 1px solid #ccc; margin: 3rem 0; }
    blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 1em; color: #666; font-style: italic; }
    .mention { font-weight: 500; }
  </style>
</head>
<body>
${combined}
</body>
</html>`
      writeFileSync(result.filePath, fullHtml, 'utf-8')
    } else {
      const combined = sections.join('\n\n---\n\n')
      writeFileSync(result.filePath, combined, 'utf-8')
    }

    return { success: true, outputPath: result.filePath }
  })
}
