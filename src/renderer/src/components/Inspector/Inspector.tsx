import React from 'react'
import { X } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { useProjectStore } from '../../stores/projectStore'
import { DocumentInspector } from './DocumentInspector'
import { EntityInspector } from './EntityInspector'

export function Inspector(): React.ReactElement {
  const { activeDocumentId, activeEntityId, setInspectorOpen, pinnedEntityId } = useUIStore()
  const { documents, entities } = useProjectStore()

  // Pinned entity takes priority when a document is active; otherwise normal priority
  const resolvedEntityId = activeEntityId || (activeDocumentId ? pinnedEntityId : null)
  const activeEntity = resolvedEntityId ? entities.find(e => e.id === resolvedEntityId) : null
  const activeDoc = activeDocumentId ? documents.find(d => d.id === activeDocumentId) : null

  const label = activeEntity ? 'Entity' : activeDoc ? 'Document' : 'Inspector'

  return (
    <aside className="h-full bg-surface-50 border-l border-surface-200 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-200 flex-shrink-0">
        <h2 className="text-sm font-semibold text-ink">{label}</h2>
        <button className="p-1 rounded hover:bg-surface-200 text-ink-muted" onClick={() => setInspectorOpen(false)}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeEntity && <EntityInspector entity={activeEntity} />}
        {!activeEntity && activeDoc && <DocumentInspector document={activeDoc} />}
        {!activeEntity && !activeDoc && (
          <div className="p-4 text-sm text-ink-muted text-center mt-4">
            Select a document or entity to see its details.
          </div>
        )}
      </div>
    </aside>
  )
}
