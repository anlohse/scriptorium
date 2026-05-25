import React, { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import { useUIStore } from '../../stores/uiStore'
import { EntityForm } from '../Entities/EntityForm'
import type { Entity, EntityType } from '../../types'

const ENTITY_TYPES: EntityType[] = ['character', 'location', 'event', 'faction', 'item', 'concept']
const TYPE_COLORS: Record<EntityType, string> = {
  character: 'bg-blue-500',
  location: 'bg-green-500',
  event: 'bg-orange-500',
  faction: 'bg-purple-500',
  item: 'bg-yellow-500',
  concept: 'bg-pink-500'
}

export function EntityList(): React.ReactElement {
  const { entities, refreshEntities } = useProjectStore()
  const { activeEntityId, setActiveEntity } = useUIStore()
  const [filter, setFilter] = useState<EntityType | 'all'>('all')
  const [showForm, setShowForm] = useState(false)

  const filtered = filter === 'all' ? entities : entities.filter(e => e.type === filter)

  const deleteEntity = async (id: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!confirm('Delete this entity? All related data will be removed.')) return
    await window.api.entity.delete(id)
    await refreshEntities()
    if (useUIStore.getState().activeEntityId === id) setActiveEntity(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-ink-faint uppercase tracking-wider">Entities</span>
        <button className="p-1 rounded hover:bg-surface-200 text-ink-muted" onClick={() => setShowForm(true)} title="New Entity">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-1 mb-3">
        <button
          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${filter === 'all' ? 'bg-ink text-white border-ink' : 'border-surface-300 text-ink-muted hover:border-ink-muted'}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        {ENTITY_TYPES.map(type => (
          <button
            key={type}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors capitalize ${filter === type ? 'bg-ink text-white border-ink' : 'border-surface-300 text-ink-muted hover:border-ink-muted'}`}
            onClick={() => setFilter(type)}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="space-y-0.5">
        {filtered.map(entity => (
          <div
            key={entity.id}
            className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group ${activeEntityId === entity.id ? 'bg-accent/10' : 'hover:bg-surface-200'}`}
            onClick={() => {
              setActiveEntity(entity.id)
              useUIStore.getState().setInspectorOpen(true)
            }}
          >
            <div className={`w-2 h-2 rounded-full shrink-0 ${TYPE_COLORS[entity.type]}`} />
            <div className="flex-1 min-w-0">
              <div className={`text-sm truncate ${activeEntityId === entity.id ? 'text-accent font-medium' : 'text-ink'}`}>
                {entity.name}
              </div>
              <div className="text-xs text-ink-faint capitalize">{entity.type}</div>
            </div>
            <button
              className="hidden group-hover:block p-0.5 rounded hover:bg-red-100 text-ink-muted hover:text-red-500"
              onClick={e => deleteEntity(entity.id, e)}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-ink-faint px-2 py-2">
            {filter === 'all' ? 'No entities yet. Create your first character, location, or other entity.' : `No ${filter}s yet.`}
          </p>
        )}
      </div>

      {showForm && (
        <EntityForm
          onSave={async (data) => {
            await window.api.entity.create(data as Record<string, unknown>)
            await refreshEntities()
            setShowForm(false)
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
