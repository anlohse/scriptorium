import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'

interface Props {
  entityId: string
  onSave: (data: { from_entity_id: string; to_entity_id: string; relation_type: string }) => Promise<void>
  onClose: () => void
}

const RELATION_TYPES = [
  'belongs_to', 'rival_of', 'ally_of', 'enemy_of', 'friend_of', 'parent_of', 'child_of',
  'sibling_of', 'loves', 'hates', 'knows', 'leads', 'member_of', 'created_by',
  'owns', 'located_in', 'participated_in', 'occurs_in', 'rules', 'serves'
]

export function RelationForm({ entityId, onSave, onClose }: Props): React.ReactElement {
  const { entities } = useProjectStore()
  const [toEntityId, setToEntityId] = useState('')
  const [relationType, setRelationType] = useState('ally_of')
  const [customType, setCustomType] = useState('')
  const [saving, setSaving] = useState(false)

  const others = entities.filter(e => e.id !== entityId)

  const handleSave = async (): Promise<void> => {
    if (!toEntityId) return
    const type = relationType === 'custom' ? customType.trim() : relationType
    if (!type) return
    setSaving(true)
    try {
      await onSave({ from_entity_id: entityId, to_entity_id: toEntityId, relation_type: type })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-ink text-sm">Add Relationship</h2>
          <button className="p-1 rounded hover:bg-surface-100 text-ink-muted" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-muted">Target Entity</label>
            <select className="input mt-1 text-sm" value={toEntityId} onChange={e => setToEntityId(e.target.value)}>
              <option value="">Select entity...</option>
              {others.map(e => <option key={e.id} value={e.id}>{e.name} ({e.type})</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-ink-muted">Relation Type</label>
            <select className="input mt-1 text-sm" value={relationType} onChange={e => setRelationType(e.target.value)}>
              {RELATION_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              <option value="custom">Custom...</option>
            </select>
            {relationType === 'custom' && (
              <input className="input mt-1 text-sm" placeholder="e.g. trained_by" value={customType} onChange={e => setCustomType(e.target.value)} />
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button className="btn-primary flex-1 text-sm" onClick={handleSave} disabled={saving || !toEntityId}>
              {saving ? 'Saving...' : 'Add Relation'}
            </button>
            <button className="btn-ghost text-sm" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}
