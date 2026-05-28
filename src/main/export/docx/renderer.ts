import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  PageBreak,
  ExternalHyperlink,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  LevelFormat,
  WidthType,
  ShadingType,
  convertMillimetersToTwip,
  convertInchesToTwip
} from 'docx'
import type {
  ExportBlock,
  ExportDocument,
  ExportWarning,
  DocxExportProfile,
  InlineNode,
  ExportTableRow
} from './types'
import { resolveAsset } from './assetResolver'

// ─── Page size map ────────────────────────────────────────────────────────────
const PAGE_SIZE_MM: Record<string, [number, number]> = {
  A4: [210, 297],
  A5: [148, 210],
  Letter: [215.9, 279.4]
}

function getPageSizeTwip(size: string): { width: number; height: number } {
  const [w, h] = PAGE_SIZE_MM[size] ?? PAGE_SIZE_MM.A4
  return { width: convertMillimetersToTwip(w), height: convertMillimetersToTwip(h) }
}

function getPageWidthIn(size: string): number {
  const [w] = PAGE_SIZE_MM[size] ?? PAGE_SIZE_MM.A4
  return w / 25.4
}

// ─── Style builder ────────────────────────────────────────────────────────────
function buildStyles(profile: DocxExportProfile) {
  const { bodyFont, headingFont, bodySizePt, lineSpacing, paragraphSpacingAfterPt } = profile.typography
  const bodyHp = bodySizePt * 2  // half-points
  const lineTwip = Math.round(lineSpacing * 240)
  const afterTwip = Math.round(paragraphSpacingAfterPt * 20)

  return {
    paragraphStyles: [
      {
        id: 'Normal',
        name: 'Normal',
        run: { font: bodyFont, size: bodyHp },
        paragraph: { spacing: { line: lineTwip, after: afterTwip } }
      },
      {
        id: 'Heading1',
        name: 'Heading 1',
        basedOn: 'Normal',
        next: 'Normal',
        run: { font: headingFont, size: 40, bold: true, color: '1F3864' },
        paragraph: { spacing: { line: 300, before: 480, after: 120 }, outlineLevel: 0 }
      },
      {
        id: 'Heading2',
        name: 'Heading 2',
        basedOn: 'Normal',
        next: 'Normal',
        run: { font: headingFont, size: 32, bold: true, color: '2E4057' },
        paragraph: { spacing: { line: 280, before: 360, after: 80 }, outlineLevel: 1 }
      },
      {
        id: 'Heading3',
        name: 'Heading 3',
        basedOn: 'Normal',
        next: 'Normal',
        run: { font: headingFont, size: 26, bold: true, color: '2E4057' },
        paragraph: { spacing: { line: 260, before: 240, after: 60 }, outlineLevel: 2 }
      },
      {
        id: 'Heading4',
        name: 'Heading 4',
        basedOn: 'Normal',
        next: 'Normal',
        run: { font: headingFont, size: bodyHp, bold: true },
        paragraph: { spacing: { line: lineTwip, before: 200, after: 40 }, outlineLevel: 3 }
      },
      {
        id: 'Quote',
        name: 'Quote',
        basedOn: 'Normal',
        run: { font: bodyFont, size: bodyHp, italics: true },
        paragraph: {
          spacing: { line: lineTwip, after: afterTwip },
          indent: { left: convertInchesToTwip(0.5), right: convertInchesToTwip(0.5) }
        }
      },
      {
        id: 'CodeBlock',
        name: 'Code Block',
        basedOn: 'Normal',
        run: { font: 'Courier New', size: bodyHp },
        paragraph: { spacing: { line: 240, after: 0 } }
      },
      {
        id: 'SceneBreak',
        name: 'Scene Break',
        basedOn: 'Normal',
        run: { font: bodyFont, size: bodyHp },
        paragraph: { alignment: AlignmentType.CENTER, spacing: { line: lineTwip, before: 240, after: 240 } }
      },
      {
        id: 'Metadata',
        name: 'Metadata',
        basedOn: 'Normal',
        run: { font: bodyFont, size: bodyHp, color: '555555' },
        paragraph: { spacing: { line: 240, after: 80 } }
      }
    ]
  }
}

// ─── Numbering ────────────────────────────────────────────────────────────────
function buildNumbering() {
  return {
    config: [
      {
        reference: 'bullet-list',
        levels: [
          {
            level: 0, format: LevelFormat.BULLET, text: '•',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } }
          },
          {
            level: 1, format: LevelFormat.BULLET, text: '◦',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: convertInchesToTwip(1), hanging: convertInchesToTwip(0.25) } } }
          },
          {
            level: 2, format: LevelFormat.BULLET, text: '▪',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: convertInchesToTwip(1.5), hanging: convertInchesToTwip(0.25) } } }
          }
        ]
      },
      {
        reference: 'ordered-list',
        levels: [
          {
            level: 0, format: LevelFormat.DECIMAL, text: '%1.',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } }
          },
          {
            level: 1, format: LevelFormat.LOWER_LETTER, text: '%2.',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: convertInchesToTwip(1), hanging: convertInchesToTwip(0.25) } } }
          },
          {
            level: 2, format: LevelFormat.LOWER_ROMAN, text: '%3.',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: convertInchesToTwip(1.5), hanging: convertInchesToTwip(0.25) } } }
          }
        ]
      }
    ]
  }
}

// ─── Inline renderer ──────────────────────────────────────────────────────────
interface RunFormat {
  bold?: boolean
  italics?: boolean
  strike?: boolean
}

type InlineRun = TextRun | ExternalHyperlink

function flattenText(nodes: InlineNode[]): string {
  return nodes.map(n => {
    if (n.type === 'text') return n.value
    if (n.type === 'inlineCode') return n.value
    if (n.type === 'internalLink') return n.label
    if ('children' in n) return flattenText((n as { children: InlineNode[] }).children)
    return ''
  }).join('')
}

function renderInlines(nodes: InlineNode[], fmt: RunFormat): InlineRun[] {
  const result: InlineRun[] = []

  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        if (node.value) result.push(new TextRun({ text: node.value, ...fmt }))
        break
      case 'strong':
        result.push(...renderInlines(node.children, { ...fmt, bold: true }))
        break
      case 'emphasis':
        result.push(...renderInlines(node.children, { ...fmt, italics: true }))
        break
      case 'delete':
        result.push(...renderInlines(node.children, { ...fmt, strike: true }))
        break
      case 'inlineCode':
        result.push(new TextRun({
          text: node.value, font: 'Courier New',
          shading: { type: ShadingType.CLEAR, fill: 'F0F0F0', color: 'auto' },
          ...fmt
        }))
        break
      case 'break':
        result.push(new TextRun({ text: '', break: 1 }))
        break
      case 'internalLink':
        result.push(new TextRun({ text: node.label, ...fmt }))
        break
      case 'link': {
        const text = flattenText(node.children)
        if (text) {
          result.push(new ExternalHyperlink({
            link: node.url,
            children: [new TextRun({ text, color: '0563C1', ...fmt })]
          }))
        }
        break
      }
    }
  }

  return result
}

// ─── Block renderer ───────────────────────────────────────────────────────────
interface RenderCtx {
  profile: DocxExportProfile
  projectPath: string
  warnings: ExportWarning[]
  documentId?: string
  styleOverride?: string
}

function renderTable(rows: ExportTableRow[], ctx: RenderCtx): Table {
  const tableRows = rows.map(row => {
    const cells = row.cells.map(cellInlines =>
      new TableCell({
        children: [new Paragraph({
          style: 'Normal',
          children: renderInlines(cellInlines, { bold: row.isHeader })
        })],
        shading: row.isHeader ? { type: ShadingType.CLEAR, fill: 'E8E8E8', color: 'auto' } : undefined
      })
    )
    return new TableRow({ children: cells })
  })

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows
  })
}

function renderImage(src: string, alt: string | undefined, ctx: RenderCtx): Paragraph | null {
  const asset = resolveAsset(src, ctx.projectPath)
  const { missingAssetBehavior } = ctx.profile.options

  if (!asset) {
    if (missingAssetBehavior === 'fail') {
      throw new Error(`Missing image: ${src}`)
    }
    ctx.warnings.push({
      code: 'MISSING_IMAGE',
      message: `Image not found: ${src}`,
      documentId: ctx.documentId,
      sourcePath: src
    })
    if (missingAssetBehavior === 'placeholder') {
      return new Paragraph({
        style: 'Normal',
        children: [new TextRun({ text: `[Image: ${alt || src}]`, italics: true, color: '888888' })]
      })
    }
    return null
  }

  // Scale to fit content width
  const pageWidthIn = getPageWidthIn(ctx.profile.page.size)
  const { margins } = ctx.profile.page
  const contentWidthIn = pageWidthIn - margins.left - margins.right
  const maxPx = Math.round(contentWidthIn * 96)

  let w = asset.widthPx
  let h = asset.heightPx

  if (w > maxPx) {
    const ratio = maxPx / w
    w = maxPx
    h = Math.round(h * ratio)
  }

  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new ImageRun({ data: asset.data, transformation: { width: w, height: h } })
    ]
  })
}

function renderList(
  ordered: boolean,
  depth: number,
  items: ExportBlock[][],
  ctx: RenderCtx
): Array<Paragraph | Table> {
  const ref = ordered ? 'ordered-list' : 'bullet-list'
  const result: Array<Paragraph | Table> = []

  for (const itemBlocks of items) {
    for (let bi = 0; bi < itemBlocks.length; bi++) {
      const block = itemBlocks[bi]
      if (block.type === 'paragraph') {
        result.push(new Paragraph({
          numbering: { reference: ref, level: Math.min(depth, 2) },
          children: renderInlines(block.children, {})
        }))
      } else if (block.type === 'list') {
        result.push(...renderList(block.ordered, block.depth + 1, block.items, ctx))
      } else {
        result.push(...renderBlocks([block], ctx))
      }
    }
  }

  return result
}

function renderBlocks(blocks: ExportBlock[], ctx: RenderCtx): Array<Paragraph | Table> {
  const result: Array<Paragraph | Table> = []
  const { profile } = ctx
  const baseStyle = ctx.styleOverride || 'Normal'

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const styleId = `Heading${Math.min(block.depth, 4)}`
        const runs = renderInlines(block.children, {})
        if (runs.length > 0) result.push(new Paragraph({ style: styleId, children: runs }))
        break
      }

      case 'paragraph': {
        const runs = renderInlines(block.children, {})
        if (runs.length === 0) break
        const indent = profile.typography.firstLineIndentIn && baseStyle === 'Normal'
          ? { firstLine: convertInchesToTwip(profile.typography.firstLineIndentIn) }
          : undefined
        result.push(new Paragraph({ style: baseStyle, children: runs, indent }))
        break
      }

      case 'blockquote': {
        const childCtx = { ...ctx, styleOverride: 'Quote' }
        result.push(...renderBlocks(block.children, childCtx))
        break
      }

      case 'code': {
        const lines = block.value.split('\n')
        for (const line of lines) {
          result.push(new Paragraph({
            style: 'CodeBlock',
            children: [new TextRun({ text: line === '' ? ' ' : line, font: 'Courier New' })]
          }))
        }
        break
      }

      case 'list':
        result.push(...renderList(block.ordered, block.depth, block.items, ctx))
        break

      case 'table':
        result.push(renderTable(block.rows, ctx))
        break

      case 'image': {
        const imgPara = renderImage(block.src, block.alt, ctx)
        if (imgPara) result.push(imgPara)
        break
      }

      case 'horizontalRule':
        result.push(new Paragraph({ style: 'SceneBreak', children: [new TextRun('* * *')] }))
        break

      case 'pageBreak':
        result.push(new Paragraph({ children: [new PageBreak()] }))
        break
    }
  }

  return result
}

// ─── Metadata page ─────────────────────────────────────────────────────────────
function buildMetadataPage(
  projectName: string,
  exportTitle: string,
  profileName: string,
  locale: string | undefined,
  exportedAt: string
): Paragraph[] {
  const line = (text: string, bold = false, size = 24) =>
    new Paragraph({ style: 'Metadata', children: [new TextRun({ text, bold, size })] })

  return [
    new Paragraph({ style: 'Heading1', children: [new TextRun({ text: projectName, bold: true })] }),
    line(exportTitle, false, 28),
    new Paragraph({ style: 'Normal', children: [] }),
    line(`Profile: ${profileName}`),
    locale ? line(`Language: ${locale}`) : new Paragraph({ children: [] }),
    line(`Exported: ${exportedAt}`),
    new Paragraph({ children: [new PageBreak()] })
  ].filter((p): p is Paragraph => !!p)
}

// ─── Main renderer ─────────────────────────────────────────────────────────────
export async function renderDocx(
  documents: ExportDocument[],
  profile: DocxExportProfile,
  projectPath: string,
  projectName: string,
  exportTitle: string,
  locale: string | undefined,
  warnings: ExportWarning[]
): Promise<Buffer> {
  const children: Array<Paragraph | Table> = []

  // Metadata page
  if (profile.options.includeMetadataPage) {
    const exportedAt = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    children.push(...buildMetadataPage(projectName, exportTitle, profile.name, locale, exportedAt))
  }

  let chapterCount = 0
  let firstDoc = true

  for (const doc of documents) {
    if (doc.docType === 'chapter') {
      chapterCount++
      // Page break between chapters
      if (!firstDoc && profile.options.startChaptersOnNewPage) {
        children.push(new Paragraph({ children: [new PageBreak()] }))
      }
    }

    const ctx: RenderCtx = {
      profile,
      projectPath,
      warnings,
      documentId: doc.id
    }

    children.push(...renderBlocks(doc.blocks, ctx))
    firstDoc = false
  }

  // Ensure at least one paragraph
  if (children.length === 0) {
    children.push(new Paragraph({ style: 'Normal', children: [new TextRun('')] }))
  }

  const pageSize = getPageSizeTwip(profile.page.size)
  const { margins } = profile.page

  const doc = new Document({
    creator: 'Scriptorium',
    title: exportTitle,
    description: `Exported from Scriptorium — profile: ${profile.name}`,
    styles: buildStyles(profile),
    numbering: buildNumbering(),
    sections: [
      {
        properties: {
          page: {
            size: { width: pageSize.width, height: pageSize.height },
            margin: {
              top: convertInchesToTwip(margins.top),
              bottom: convertInchesToTwip(margins.bottom),
              left: convertInchesToTwip(margins.left),
              right: convertInchesToTwip(margins.right)
            }
          }
        },
        children
      }
    ]
  })

  return Packer.toBuffer(doc)
}
