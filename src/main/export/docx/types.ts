export type ExportScope =
  | { type: 'chapter'; chapterId: string }
  | { type: 'volume'; volumeId: string }
  | { type: 'project' }
  | { type: 'selection'; documentIds: string[] }

export type ExportBlock =
  | { type: 'heading'; depth: 1 | 2 | 3 | 4 | 5 | 6; children: InlineNode[] }
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'blockquote'; children: ExportBlock[] }
  | { type: 'list'; ordered: boolean; depth: number; items: ExportBlock[][] }
  | { type: 'code'; lang?: string; value: string }
  | { type: 'table'; rows: ExportTableRow[] }
  | { type: 'image'; src: string; alt?: string; title?: string }
  | { type: 'horizontalRule' }
  | { type: 'pageBreak' }

export interface ExportTableRow {
  isHeader: boolean
  cells: InlineNode[][]
}

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: InlineNode[] }
  | { type: 'emphasis'; children: InlineNode[] }
  | { type: 'delete'; children: InlineNode[] }
  | { type: 'inlineCode'; value: string }
  | { type: 'link'; url: string; children: InlineNode[] }
  | { type: 'internalLink'; target: string; label: string }
  | { type: 'break' }

export interface ExportDocument {
  id: string
  title: string
  docType: 'chapter' | 'scene' | 'note' | 'lore' | 'draft'
  blocks: ExportBlock[]
}

export interface DocxExportProfile {
  id: string
  name: string
  page: {
    size: 'A4' | 'A5' | 'Letter'
    margins: { top: number; bottom: number; left: number; right: number }
  }
  typography: {
    bodyFont: string
    headingFont: string
    bodySizePt: number
    lineSpacing: number
    paragraphSpacingAfterPt: number
    firstLineIndentIn?: number
  }
  options: {
    includeCover: boolean
    includeTableOfContents: boolean
    includeMetadataPage: boolean
    startChaptersOnNewPage: boolean
    includeChapterNumbers: boolean
    renderInternalLinks: 'plain' | 'styled' | 'raw'
    missingAssetBehavior: 'warning' | 'placeholder' | 'fail'
  }
}

export type ExportWarningCode =
  | 'MISSING_IMAGE'
  | 'UNRESOLVED_INTERNAL_LINK'
  | 'UNSUPPORTED_NODE'
  | 'TABLE_RENDER_LIMITATION'
  | 'INVALID_FRONTMATTER'

export interface ExportWarning {
  code: ExportWarningCode
  message: string
  documentId?: string
  sourcePath?: string
}

export interface DocxExportRequest {
  scope: ExportScope
  locale?: string
  profileId: string
  fallbackToOriginal?: boolean
}

export interface DocxExportResult {
  success: boolean
  outputPath?: string
  warnings: ExportWarning[]
  error?: string
}
