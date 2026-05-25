import React, { useState } from 'react'
import { Plus, Image, Trash2 } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import type { Asset } from '../../types'

const ASSET_TYPES = ['character', 'map', 'concept_art', 'cover', 'moodboard', 'other'] as const

export function AssetList(): React.ReactElement {
  const { assets, refreshAssets } = useProjectStore()
  const [filter, setFilter] = useState<string>('all')
  const [showImport, setShowImport] = useState(false)
  const [importType, setImportType] = useState('character')
  const [importTitle, setImportTitle] = useState('')

  const filtered = filter === 'all' ? assets : assets.filter(a => a.type === filter)

  const handleImport = async (): Promise<void> => {
    const result = await window.api.asset.import(importType)
    if (result.canceled || !result.success) return
    await window.api.asset.create({ path: result.path, type: importType, title: importTitle || 'Asset', description: '', tags: [], entity_id: null })
    setShowImport(false)
    setImportTitle('')
    await refreshAssets()
  }

  const deleteAsset = async (id: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!confirm('Remove this asset from the project?')) return
    await window.api.asset.delete(id)
    await refreshAssets()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-ink-faint uppercase tracking-wider">Assets</span>
        <button className="p-1 rounded hover:bg-surface-200 text-ink-muted" onClick={() => setShowImport(true)}>
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-1 mb-3">
        <button className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${filter === 'all' ? 'bg-ink text-white border-ink' : 'border-surface-300 text-ink-muted'}`} onClick={() => setFilter('all')}>All</button>
        {ASSET_TYPES.map(t => (
          <button key={t} className={`text-xs px-2 py-0.5 rounded-full border transition-colors capitalize ${filter === t ? 'bg-ink text-white border-ink' : 'border-surface-300 text-ink-muted'}`} onClick={() => setFilter(t)}>
            {t.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1">
        {filtered.map(asset => (
          <div key={asset.id} className="relative group rounded-md overflow-hidden bg-surface-200 aspect-square">
            <img src={`file:///${asset.path.replace(/\\/g, '/')}`} alt={asset.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
              <span className="text-white text-xs truncate flex-1">{asset.title}</span>
              <button className="p-0.5 rounded bg-red-500/80 text-white" onClick={e => deleteAsset(asset.id, e)}>
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && !showImport && (
        <div className="flex flex-col items-center gap-2 py-6 text-ink-faint">
          <Image className="w-8 h-8" />
          <p className="text-xs text-center">No assets yet. Import images to add character references, maps, and more.</p>
        </div>
      )}

      {showImport && (
        <div className="mt-3 p-3 bg-white rounded-lg border border-surface-200 space-y-2">
          <p className="text-sm font-medium">Import Asset</p>
          <select className="input text-xs" value={importType} onChange={e => setImportType(e.target.value)}>
            {ASSET_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
          <input className="input text-xs" placeholder="Title (optional)" value={importTitle} onChange={e => setImportTitle(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn-primary text-xs flex-1" onClick={handleImport}>Choose File</button>
            <button className="btn-ghost text-xs" onClick={() => setShowImport(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
