import { marked } from 'marked'
import type { ExportBlock, ExportTableRow, InlineNode, ExportWarning } from './types'

// Use `any` for marked tokens since the shapes are well-known at runtime
// but complex to type-import across library versions.
type MToken = Record<string, unknown>

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

const INTERNAL_LINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

function parseInternalLinks(text: string): InlineNode[] {
  const nodes: InlineNode[] = []
  let lastIndex = 0
  INTERNAL_LINK_RE.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = INTERNAL_LINK_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index)
      if (before) nodes.push({ type: 'text', value: before })
    }
    const target = match[1].trim()
    const label = (match[2] || match[1]).trim()
    nodes.push({ type: 'internalLink', target, label })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    const rest = text.slice(lastIndex)
    if (rest) nodes.push({ type: 'text', value: rest })
  }

  return nodes
}

function processInlineTokens(tokens: MToken[]): InlineNode[] {
  const nodes: InlineNode[] = []

  for (const token of tokens) {
    const type = token.type as string

    switch (type) {
      case 'text': {
        const subTokens = token.tokens as MToken[] | undefined
        if (subTokens && subTokens.length > 0) {
          nodes.push(...processInlineTokens(subTokens))
        } else {
          const text = decodeEntities((token.text as string) || '')
          nodes.push(...parseInternalLinks(text))
        }
        break
      }
      case 'escape': {
        const text = (token.text as string) || ''
        if (text) nodes.push({ type: 'text', value: text })
        break
      }
      case 'strong': {
        const children = processInlineTokens((token.tokens as MToken[]) || [])
        if (children.length > 0) nodes.push({ type: 'strong', children })
        break
      }
      case 'em': {
        const children = processInlineTokens((token.tokens as MToken[]) || [])
        if (children.length > 0) nodes.push({ type: 'emphasis', children })
        break
      }
      case 'del': {
        const children = processInlineTokens((token.tokens as MToken[]) || [])
        if (children.length > 0) nodes.push({ type: 'delete', children })
        break
      }
      case 'codespan': {
        const text = (token.text as string) || ''
        if (text) nodes.push({ type: 'inlineCode', value: text })
        break
      }
      case 'br':
        nodes.push({ type: 'break' })
        break
      case 'link': {
        const href = (token.href as string) || ''
        const children = processInlineTokens((token.tokens as MToken[]) || [])
        if (children.length > 0) nodes.push({ type: 'link', url: href, children })
        break
      }
      case 'image': {
        // Images inside inline context — emit as text placeholder
        const alt = (token.text as string) || ''
        const src = (token.href as string) || ''
        nodes.push({ type: 'text', value: `[Image: ${alt || src}]` })
        break
      }
      default:
        // Fallback: extract text
        if (token.text) nodes.push({ type: 'text', value: decodeEntities(token.text as string) })
    }
  }

  return nodes
}

function processBlockTokens(
  tokens: MToken[],
  warnings?: ExportWarning[],
  documentId?: string
): ExportBlock[] {
  const blocks: ExportBlock[] = []

  for (const token of tokens) {
    const type = token.type as string

    switch (type) {
      case 'heading': {
        const depth = Math.min(Math.max((token.depth as number) || 1, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6
        const children = processInlineTokens((token.tokens as MToken[]) || [])
        if (children.length > 0) blocks.push({ type: 'heading', depth, children })
        break
      }

      case 'paragraph': {
        // Check if the paragraph is a standalone image
        const inlineTokens = (token.tokens as MToken[]) || []
        if (inlineTokens.length === 1 && inlineTokens[0].type === 'image') {
          const img = inlineTokens[0]
          blocks.push({
            type: 'image',
            src: (img.href as string) || '',
            alt: (img.text as string) || undefined,
            title: (img.title as string) || undefined
          })
        } else {
          const children = processInlineTokens(inlineTokens)
          if (children.length > 0) blocks.push({ type: 'paragraph', children })
        }
        break
      }

      case 'blockquote': {
        const children = processBlockTokens((token.tokens as MToken[]) || [], warnings, documentId)
        if (children.length > 0) blocks.push({ type: 'blockquote', children })
        break
      }

      case 'list': {
        const ordered = (token.ordered as boolean) || false
        const items: ExportBlock[][] = []
        const listItems = (token.items as MToken[]) || []

        for (const item of listItems) {
          const itemTokens = (item.tokens as MToken[]) || []
          const loose = (item.loose as boolean) || false
          let itemBlocks: ExportBlock[]

          if (loose) {
            itemBlocks = processBlockTokens(itemTokens, warnings, documentId)
          } else {
            // Tight list — inline tokens, possibly wrapped in a paragraph token
            const firstToken = itemTokens[0]
            if (firstToken && firstToken.type === 'text') {
              const subTokens = (firstToken.tokens as MToken[] | undefined) || []
              const children = subTokens.length > 0
                ? processInlineTokens(subTokens)
                : parseInternalLinks(decodeEntities((firstToken.text as string) || ''))
              if (children.length > 0) {
                itemBlocks = [{ type: 'paragraph', children }]
              } else {
                itemBlocks = []
              }
            } else {
              itemBlocks = processBlockTokens(itemTokens, warnings, documentId)
            }
          }

          if (itemBlocks.length > 0) items.push(itemBlocks)
        }

        if (items.length > 0) blocks.push({ type: 'list', ordered, depth: 0, items })
        break
      }

      case 'code': {
        const value = (token.text as string) || ''
        const lang = (token.lang as string) || undefined
        blocks.push({ type: 'code', lang, value })
        break
      }

      case 'table': {
        const rows = parseTableToken(token)
        if (rows.length > 0) blocks.push({ type: 'table', rows })
        break
      }

      case 'hr':
        blocks.push({ type: 'horizontalRule' })
        break

      case 'html': {
        const raw = ((token.raw as string) || '').trim()
        if (raw === '<!-- page-break -->' || raw === '<!--page-break-->') {
          blocks.push({ type: 'pageBreak' })
        } else if (raw === '<!-- scene-break -->' || raw === '<!--scene-break-->') {
          blocks.push({ type: 'horizontalRule' })
        }
        // Other HTML blocks are silently dropped in Markdown context
        break
      }

      case 'space':
        break

      default:
        if (warnings) {
          warnings.push({
            code: 'UNSUPPORTED_NODE',
            message: `Unsupported Markdown token type: ${type}`,
            documentId
          })
        }
    }
  }

  return blocks
}

function parseTableToken(token: MToken): ExportTableRow[] {
  const rows: ExportTableRow[] = []

  const header = (token.header as MToken[]) || []
  if (header.length > 0) {
    const cells = header.map(cell => processInlineTokens((cell.tokens as MToken[]) || []))
    rows.push({ isHeader: true, cells })
  }

  const tableRows = (token.rows as MToken[][]) || []
  for (const row of tableRows) {
    const cells = row.map(cell => processInlineTokens((cell.tokens as MToken[]) || []))
    rows.push({ isHeader: false, cells })
  }

  return rows
}

export function mdToBlocks(
  markdown: string,
  warnings?: ExportWarning[],
  documentId?: string
): ExportBlock[] {
  if (!markdown.trim()) return []
  try {
    const tokens = marked.lexer(markdown) as unknown as MToken[]
    return processBlockTokens(tokens, warnings, documentId)
  } catch (err) {
    if (warnings) {
      warnings.push({
        code: 'UNSUPPORTED_NODE',
        message: `Markdown parse error: ${err instanceof Error ? err.message : String(err)}`,
        documentId
      })
    }
    return []
  }
}
