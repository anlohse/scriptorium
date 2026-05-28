import { existsSync, readFileSync } from 'fs'
import { join, isAbsolute, resolve, dirname, extname } from 'path'
import { fileURLToPath } from 'url'
import sizeOf from 'image-size'

export interface ResolvedAsset {
  absolutePath: string
  mimeType: string
  widthPx: number
  heightPx: number
  data: Buffer
}

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff'
}

function getMimeType(filePath: string): string {
  const ext = extname(filePath).replace('.', '').toLowerCase()
  return MIME_MAP[ext] || 'image/png'
}

function tryPath(p: string): string | null {
  return existsSync(p) ? p : null
}

function normalizeSrc(src: string): string {
  if (src.startsWith('file://')) {
    try {
      return fileURLToPath(src)
    } catch {
      // Strip the scheme manually as fallback
      return src.replace(/^file:\/\/\//, '').replace(/^file:\/\//, '')
    }
  }
  return src
}

export function resolveImagePath(src: string, projectPath: string, docDir?: string): string | null {
  if (!src || src.startsWith('data:')) return null

  const normalized = normalizeSrc(src)

  // Already absolute
  if (isAbsolute(normalized)) return tryPath(normalized)

  // Relative to document directory
  if (docDir) {
    const fromDoc = resolve(docDir, normalized)
    if (tryPath(fromDoc)) return fromDoc
  }

  // Relative to project root
  const fromProject = join(projectPath, normalized)
  if (tryPath(fromProject)) return fromProject

  // Strip leading ./ or ../
  const stripped = normalized.replace(/^(?:\.\.?\/)+/, '')
  if (stripped !== normalized) {
    const fromStripped = join(projectPath, stripped)
    if (tryPath(fromStripped)) return fromStripped
  }

  return null
}

export function resolveAsset(
  src: string,
  projectPath: string,
  docDir?: string
): ResolvedAsset | null {
  const absPath = resolveImagePath(src, projectPath, docDir)
  if (!absPath) return null

  try {
    const data = readFileSync(absPath)
    let widthPx = 600
    let heightPx = 400

    try {
      const dims = sizeOf(data)
      if (dims.width) widthPx = dims.width
      if (dims.height) heightPx = dims.height
    } catch {
      // Proceed with default dimensions if image-size fails
    }

    return {
      absolutePath: absPath,
      mimeType: getMimeType(absPath),
      widthPx,
      heightPx,
      data
    }
  } catch {
    return null
  }
}

export function getDocDir(docPath: string): string {
  return dirname(docPath)
}
