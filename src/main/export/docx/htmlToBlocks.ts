import { parseDocument } from 'htmlparser2'
import type { ExportBlock, ExportTableRow, InlineNode, ExportWarning } from './types'

// Minimal DOM node types (compatible with domhandler v5 shapes)
interface AnyNode { type: string }
interface ElNode extends AnyNode {
  name: string
  attribs: Record<string, string>
  children: AnyNode[]
}
interface TxNode extends AnyNode { data: string }

function isEl(n: AnyNode): n is ElNode {
  return n.type === 'tag' || n.type === 'script' || n.type === 'style'
}
function isTx(n: AnyNode): n is TxNode { return n.type === 'text' }
function isCm(n: AnyNode): n is TxNode { return n.type === 'comment' }

function getTextContent(node: ElNode): string {
  let text = ''
  for (const child of node.children) {
    if (isTx(child)) text += child.data
    else if (isEl(child)) text += getTextContent(child)
  }
  return text
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function findFirstEl(nodes: AnyNode[], tag: string): ElNode | null {
  for (const node of nodes) {
    if (isEl(node) && node.name === tag) return node
    if (isEl(node)) {
      const found = findFirstEl(node.children, tag)
      if (found) return found
    }
  }
  return null
}

function nodesToInlines(nodes: AnyNode[]): InlineNode[] {
  const result: InlineNode[] = []
  for (const node of nodes) {
    if (isTx(node)) {
      const text = decodeEntities(node.data)
      if (text) result.push({ type: 'text', value: text })
      continue
    }
    if (!isEl(node)) continue
    const tag = node.name.toLowerCase()

    switch (tag) {
      case 'strong':
      case 'b':
        result.push({ type: 'strong', children: nodesToInlines(node.children) })
        break
      case 'em':
      case 'i':
        result.push({ type: 'emphasis', children: nodesToInlines(node.children) })
        break
      case 's':
      case 'del':
      case 'strike':
        result.push({ type: 'delete', children: nodesToInlines(node.children) })
        break
      case 'code':
        result.push({ type: 'inlineCode', value: decodeEntities(getTextContent(node)) })
        break
      case 'br':
        result.push({ type: 'break' })
        break
      case 'a': {
        const href = node.attribs.href || ''
        result.push({ type: 'link', url: href, children: nodesToInlines(node.children) })
        break
      }
      case 'span': {
        if (node.attribs['data-type'] === 'mention') {
          const label = node.attribs['data-label'] || node.attribs['data-id'] || getTextContent(node).replace(/^@/, '')
          result.push({ type: 'internalLink', target: label, label })
        } else {
          result.push(...nodesToInlines(node.children))
        }
        break
      }
      case 'img':
        // Inline image — render as placeholder text
        result.push({ type: 'text', value: `[Image: ${node.attribs.alt || node.attribs.src || 'image'}]` })
        break
      default:
        // Unknown inline — pass through children
        result.push(...nodesToInlines(node.children))
    }
  }
  return result
}

function isImageOnlyParagraph(node: ElNode): ElNode | null {
  const meaningful = node.children.filter(c => {
    if (isTx(c)) return c.data.trim().length > 0
    if (isEl(c)) return true
    return false
  })
  if (meaningful.length === 1 && isEl(meaningful[0]) && (meaningful[0] as ElNode).name === 'img') {
    return meaningful[0] as ElNode
  }
  return null
}

function listItemToBlocks(node: ElNode): ExportBlock[] {
  // Tiptap wraps <li> content in <p>; fall back to inline if no block children
  const hasBlockChild = node.children.some(c => isEl(c) && ['p', 'ul', 'ol', 'blockquote', 'pre'].includes((c as ElNode).name))
  if (hasBlockChild) {
    return nodesToBlocks(node.children)
  }
  // Tight list item — inline content directly in <li>
  const inlines = nodesToInlines(node.children)
  if (inlines.length === 0) return []
  return [{ type: 'paragraph', children: inlines }]
}

function nodesToBlocks(nodes: AnyNode[]): ExportBlock[] {
  const blocks: ExportBlock[] = []

  for (const node of nodes) {
    if (isCm(node)) {
      const comment = node.data.trim()
      if (comment === 'page-break') { blocks.push({ type: 'pageBreak' }); continue }
      if (comment === 'scene-break') { blocks.push({ type: 'horizontalRule' }); continue }
      continue
    }
    if (isTx(node)) {
      const text = decodeEntities(node.data).trim()
      if (text) blocks.push({ type: 'paragraph', children: [{ type: 'text', value: text }] })
      continue
    }
    if (!isEl(node)) continue

    const tag = node.name.toLowerCase()

    if (tag === 'p' || tag === 'div') {
      const imgOnly = isImageOnlyParagraph(node)
      if (imgOnly) {
        blocks.push({ type: 'image', src: imgOnly.attribs.src || '', alt: imgOnly.attribs.alt, title: imgOnly.attribs.title })
        continue
      }
      const inlines = nodesToInlines(node.children)
      if (inlines.length > 0) blocks.push({ type: 'paragraph', children: inlines })

    } else if (/^h[1-6]$/.test(tag)) {
      const depth = parseInt(tag[1], 10) as 1 | 2 | 3 | 4 | 5 | 6
      const inlines = nodesToInlines(node.children)
      if (inlines.length > 0) blocks.push({ type: 'heading', depth, children: inlines })

    } else if (tag === 'ul' || tag === 'ol') {
      const items = node.children
        .filter(c => isEl(c) && (c as ElNode).name === 'li')
        .map(li => listItemToBlocks(li as ElNode))
        .filter(item => item.length > 0)
      if (items.length > 0) {
        blocks.push({ type: 'list', ordered: tag === 'ol', depth: 0, items })
      }

    } else if (tag === 'blockquote') {
      const children = nodesToBlocks(node.children)
      if (children.length > 0) blocks.push({ type: 'blockquote', children })

    } else if (tag === 'hr') {
      blocks.push({ type: 'horizontalRule' })

    } else if (tag === 'div' && node.attribs['data-type'] === 'page-break') {
      blocks.push({ type: 'pageBreak' })

    } else if (tag === 'pre') {
      const codeEl = node.children.find(c => isEl(c) && (c as ElNode).name === 'code')
      const lang = codeEl ? ((codeEl as ElNode).attribs.class || '').replace('language-', '') || undefined : undefined
      const text = codeEl ? getTextContent(codeEl as ElNode) : getTextContent(node)
      blocks.push({ type: 'code', lang, value: text })

    } else if (tag === 'img') {
      blocks.push({ type: 'image', src: node.attribs.src || '', alt: node.attribs.alt, title: node.attribs.title })

    } else if (tag === 'figure') {
      const imgEl = findFirstEl(node.children, 'img')
      if (imgEl) blocks.push({ type: 'image', src: imgEl.attribs.src || '', alt: imgEl.attribs.alt })

    } else if (tag === 'table') {
      const rows = parseTable(node)
      if (rows.length > 0) blocks.push({ type: 'table', rows })

    } else {
      // Pass through unknown block-level tags by processing children
      blocks.push(...nodesToBlocks(node.children))
    }
  }

  return blocks
}

function parseTable(tableEl: ElNode): ExportTableRow[] {
  const rows: ExportTableRow[] = []
  const tbodies = tableEl.children.filter(c => isEl(c) && ['thead', 'tbody', 'tfoot', 'tr'].includes((c as ElNode).name))

  for (const section of tbodies) {
    if (!isEl(section)) continue
    const trs = section.name === 'tr' ? [section] : section.children.filter(c => isEl(c) && (c as ElNode).name === 'tr')
    const isHeader = section.name === 'thead'

    for (const tr of trs) {
      if (!isEl(tr)) continue
      const cells = tr.children
        .filter(c => isEl(c) && ['td', 'th'].includes((c as ElNode).name))
        .map(cell => nodesToInlines((cell as ElNode).children))
      if (cells.length > 0) rows.push({ isHeader, cells })
    }
  }

  return rows
}

export function htmlToBlocks(html: string, warnings?: ExportWarning[], documentId?: string): ExportBlock[] {
  if (!html.trim()) return []
  try {
    const doc = parseDocument(html)
    return nodesToBlocks(doc.children as AnyNode[])
  } catch (err) {
    if (warnings) {
      warnings.push({
        code: 'UNSUPPORTED_NODE',
        message: `HTML parse error: ${err instanceof Error ? err.message : String(err)}`,
        documentId
      })
    }
    return []
  }
}
