import type { DocxExportProfile } from './types'

export const DRAFT_PROFILE: DocxExportProfile = {
  id: 'draft',
  name: 'Draft',
  page: {
    size: 'A4',
    margins: { top: 1, bottom: 1, left: 1, right: 1 }
  },
  typography: {
    bodyFont: 'Calibri',
    headingFont: 'Calibri',
    bodySizePt: 12,
    lineSpacing: 1.5,
    paragraphSpacingAfterPt: 6
  },
  options: {
    includeCover: false,
    includeTableOfContents: false,
    includeMetadataPage: false,
    startChaptersOnNewPage: true,
    includeChapterNumbers: false,
    renderInternalLinks: 'plain',
    missingAssetBehavior: 'warning'
  }
}

export const EDITOR_REVIEW_PROFILE: DocxExportProfile = {
  id: 'editor-review',
  name: 'Editor Review',
  page: {
    size: 'A4',
    margins: { top: 1, bottom: 1, left: 1.25, right: 1.25 }
  },
  typography: {
    bodyFont: 'Calibri',
    headingFont: 'Calibri',
    bodySizePt: 12,
    lineSpacing: 2.0,
    paragraphSpacingAfterPt: 0
  },
  options: {
    includeCover: false,
    includeTableOfContents: false,
    includeMetadataPage: true,
    startChaptersOnNewPage: true,
    includeChapterNumbers: false,
    renderInternalLinks: 'plain',
    missingAssetBehavior: 'warning'
  }
}

export const MANUSCRIPT_PROFILE: DocxExportProfile = {
  id: 'manuscript',
  name: 'Manuscript',
  page: {
    size: 'Letter',
    margins: { top: 1, bottom: 1, left: 1, right: 1 }
  },
  typography: {
    bodyFont: 'Times New Roman',
    headingFont: 'Times New Roman',
    bodySizePt: 12,
    lineSpacing: 2.0,
    paragraphSpacingAfterPt: 0,
    firstLineIndentIn: 0.5
  },
  options: {
    includeCover: false,
    includeTableOfContents: false,
    includeMetadataPage: false,
    startChaptersOnNewPage: true,
    includeChapterNumbers: false,
    renderInternalLinks: 'plain',
    missingAssetBehavior: 'warning'
  }
}

export const DEFAULT_PROFILES: DocxExportProfile[] = [
  DRAFT_PROFILE,
  EDITOR_REVIEW_PROFILE,
  MANUSCRIPT_PROFILE
]

export function getProfile(id: string): DocxExportProfile {
  return DEFAULT_PROFILES.find(p => p.id === id) ?? DRAFT_PROFILE
}
