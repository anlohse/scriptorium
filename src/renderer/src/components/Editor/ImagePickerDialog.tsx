import React, { useState } from 'react'
import { X, Image as ImageIcon, Check } from 'lucide-react'
import type { Asset } from '../../types'

interface Props {
  assets: Asset[]
  onInsert: (src: string, width: number | null, height: number | null, alt: string) => void
  onClose: () => void
}

function assetToUrl(path: string): string {
  return `file:///${path.replace(/\\/g, '/')}`
}

export function ImagePickerDialog({ assets, onInsert, onClose }: Props): React.ReactElement {
  const images = assets.filter(a => /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(a.path))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [alt, setAlt] = useState('')

  const selected = images.find(a => a.id === selectedId)

  const handleInsert = (): void => {
    if (!selected) return
    const src = assetToUrl(selected.path)
    const w = width ? parseInt(width, 10) : null
    const h = height ? parseInt(height, 10) : null
    onInsert(src, w, h, alt || selected.title || '')
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 580, maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-accent" />
            <h2 className="font-semibold text-ink text-sm">Insert Image from Assets</h2>
          </div>
          <button className="p-1 rounded hover:bg-surface-100 text-ink-muted" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Asset grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {images.length === 0 ? (
            <div className="text-center py-12 text-ink-faint">
              <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No image assets in this project yet.</p>
              <p className="text-xs mt-1">Import images from the Assets sidebar first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {images.map(asset => (
                <button
                  key={asset.id}
                  onClick={() => { setSelectedId(asset.id); setAlt(asset.title || '') }}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all aspect-square bg-surface-100 ${
                    selectedId === asset.id
                      ? 'border-accent shadow-md'
                      : 'border-transparent hover:border-surface-300'
                  }`}
                >
                  <img
                    src={assetToUrl(asset.path)}
                    alt={asset.title}
                    className="w-full h-full object-cover"
                  />
                  {selectedId === asset.id && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {asset.title && (
                    <div className="absolute bottom-0 inset-x-0 bg-black/50 px-1 py-0.5">
                      <p className="text-[9px] text-white truncate">{asset.title}</p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Options */}
        {selected && (
          <div className="border-t border-surface-200 px-4 py-3 bg-surface-50 flex-shrink-0 space-y-3">
            {/* Dimensions */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <label className="text-xs text-ink-muted w-12 shrink-0">Width</label>
                <input
                  type="number"
                  className="input text-sm py-1"
                  placeholder="auto"
                  value={width}
                  onChange={e => setWidth(e.target.value)}
                  min={1}
                />
                <span className="text-xs text-ink-faint">px</span>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <label className="text-xs text-ink-muted w-12 shrink-0">Height</label>
                <input
                  type="number"
                  className="input text-sm py-1"
                  placeholder="auto"
                  value={height}
                  onChange={e => setHeight(e.target.value)}
                  min={1}
                />
                <span className="text-xs text-ink-faint">px</span>
              </div>
            </div>

            {/* Alt text */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-ink-muted w-12 shrink-0">Alt text</label>
              <input
                type="text"
                className="input text-sm py-1 flex-1"
                placeholder="Description for accessibility"
                value={alt}
                onChange={e => setAlt(e.target.value)}
              />
            </div>

            <p className="text-[10px] text-ink-faint">Leave width/height blank to use the image's natural dimensions.</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-surface-200 flex-shrink-0">
          <button className="btn-ghost text-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary text-sm"
            onClick={handleInsert}
            disabled={!selected}
          >
            Insert Image
          </button>
        </div>
      </div>
    </div>
  )
}
