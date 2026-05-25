import React, { useState } from 'react'
import { Plus, FileText, Trash2, BookOpen, ChevronUp, ChevronDown } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import { useUIStore } from '../../stores/uiStore'
import type { Document } from '../../types'

export function NotesTree(): React.ReactElement {
  const { documents, refreshDocuments } = useProjectStore()
  const { activeDocumentId, setActiveDocument } = useUIStore()
  const [adding, setAdding] = useState<'note' | 'lore' | null>(null)
  const [newName, setNewName] = useState('')

  const notes = documents.filter(d => d.type === 'note').sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
  const lore = documents.filter(d => d.type === 'lore').sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))

  const createDoc = async (type: 'note' | 'lore'): Promise<void> => {
    if (!newName.trim()) return
    const doc = await window.api.doc.create({ title: newName.trim(), type })
    setNewName('')
    setAdding(null)
    await refreshDocuments()
    setActiveDocument(doc.id)
  }

  const deleteDoc = async (id: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!confirm('Delete this document?')) return
    await window.api.doc.delete(id)
    await refreshDocuments()
    if (useUIStore.getState().activeDocumentId === id) setActiveDocument(null)
  }

  const moveDoc = async (items: Document[], idx: number, direction: -1 | 1): Promise<void> => {
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= items.length) return
    const reordered = [...items]
    ;[reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]]
    await window.api.doc.reorder(reordered.map((d, i) => ({ id: d.id, sort_order: i })))
    await refreshDocuments()
  }

  const Section = ({ label, docs, type }: { label: string; docs: Document[]; type: 'note' | 'lore' }): React.ReactElement => (
    <div className="mb-4">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-xs font-semibold text-ink-faint uppercase tracking-wider">{label}</span>
        <button className="p-1 rounded hover:bg-surface-200 text-ink-muted" onClick={() => { setAdding(type); setNewName('') }}>
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {adding === type && (
        <div className="px-1 mb-1">
          <input
            className="input text-xs py-1 w-full"
            placeholder={`New ${label.toLowerCase()}...`}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createDoc(type); if (e.key === 'Escape') setAdding(null) }}
            autoFocus
          />
        </div>
      )}
      {docs.map((doc, idx, arr) => (
        <div
          key={doc.id}
          className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer group ${activeDocumentId === doc.id ? 'bg-accent/10 text-accent' : 'hover:bg-surface-200 text-ink'}`}
          onClick={() => setActiveDocument(doc.id)}
        >
          {type === 'lore' ? <BookOpen className="w-3.5 h-3.5 shrink-0" /> : <FileText className="w-3.5 h-3.5 shrink-0" />}
          <span className="flex-1 text-sm truncate">{doc.title}</span>
          <div className="hidden group-hover:flex items-center gap-0.5">
            {idx > 0 && (
              <button
                className="p-0.5 rounded hover:bg-surface-300 text-ink-muted"
                onClick={e => { e.stopPropagation(); moveDoc(arr, idx, -1) }}
                title="Move up"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
            )}
            {idx < arr.length - 1 && (
              <button
                className="p-0.5 rounded hover:bg-surface-300 text-ink-muted"
                onClick={e => { e.stopPropagation(); moveDoc(arr, idx, 1) }}
                title="Move down"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            )}
            <button
              className="p-0.5 rounded hover:bg-red-100 text-ink-muted hover:text-red-500"
              onClick={e => deleteDoc(doc.id, e)}
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
      {docs.length === 0 && adding !== type && (
        <p className="text-xs text-ink-faint px-2 py-1">No {label.toLowerCase()} yet</p>
      )}
    </div>
  )

  return (
    <div>
      <Section label="Notes" docs={notes} type="note" />
      <Section label="Lore" docs={lore} type="lore" />
    </div>
  )
}
