import React, { useState } from 'react'
import { X } from 'lucide-react'
import type { EntityType } from '../../types'

interface Props {
  onSave: (data: { name: string; type: EntityType; summary: string; description: string; tags: string[]; aliases: string[] }) => Promise<void>
  onClose: () => void
}

const TYPES: EntityType[] = ['character', 'location', 'event', 'faction', 'item', 'concept']

export function EntityForm({ onSave, onClose }: Props): React.ReactElement {
  const [name, setName] = useState('')
  const [type, setType] = useState<EntityType>('character')
  const [summary, setSummary] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), type, summary, description: '', tags: [], aliases: [] })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-ink">New Entity</h2>
          <button className="p-1 rounded hover:bg-surface-100 text-ink-muted" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-muted">Name</label>
            <input
              className="input mt-1"
              placeholder="Entity name..."
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-medium text-ink-muted">Type</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {TYPES.map(t => (
                <button
                  key={t}
                  className={`text-xs px-3 py-1 rounded-full border capitalize transition-colors ${type === t ? 'bg-accent text-white border-accent' : 'border-surface-300 text-ink-muted hover:border-accent'}`}
                  onClick={() => setType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-ink-muted">Summary (optional)</label>
            <textarea
              className="input mt-1 resize-none"
              rows={2}
              placeholder="Brief description..."
              value={summary}
              onChange={e => setSummary(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button className="btn-primary flex-1" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'Creating...' : 'Create Entity'}
            </button>
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}
