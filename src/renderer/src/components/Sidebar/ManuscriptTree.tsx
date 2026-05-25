import React, { useState } from 'react'
import { Plus, ChevronRight, ChevronDown, ChevronUp, BookMarked, FileText, Trash2, FolderPlus } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import { useUIStore } from '../../stores/uiStore'
import type { Volume, Document } from '../../types'

export function ManuscriptTree(): React.ReactElement {
  const { volumes, documents, refreshDocuments, refreshVolumes } = useProjectStore()
  const { activeDocumentId, setActiveDocument } = useUIStore()
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set())
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())
  const [newVolumeName, setNewVolumeName] = useState('')
  const [addingVolume, setAddingVolume] = useState(false)
  const [addingChapterTo, setAddingChapterTo] = useState<string | null>(null)
  const [newChapterName, setNewChapterName] = useState('')

  const toggleVolume = (id: string): void => {
    setExpandedVolumes(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleDoc = (id: string): void => {
    setExpandedDocs(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const createVolume = async (): Promise<void> => {
    if (!newVolumeName.trim()) return
    await window.api.vol.create({ title: newVolumeName.trim() })
    setNewVolumeName('')
    setAddingVolume(false)
    await refreshVolumes()
  }

  const createChapter = async (volumeId: string): Promise<void> => {
    if (!newChapterName.trim()) return
    const doc = await window.api.doc.create({ title: newChapterName.trim(), type: 'chapter', volume_id: volumeId })
    setNewChapterName('')
    setAddingChapterTo(null)
    await refreshDocuments()
    setActiveDocument(doc.id)
  }

  const createScene = async (parentId: string, volumeId: string): Promise<void> => {
    const doc = await window.api.doc.create({ title: 'New Scene', type: 'scene', parent_id: parentId, volume_id: volumeId })
    await refreshDocuments()
    setActiveDocument(doc.id)
  }

  const deleteDoc = async (id: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!confirm('Delete this document? This cannot be undone.')) return
    await window.api.doc.delete(id)
    await refreshDocuments()
    const { activeDocumentId: current } = useUIStore.getState()
    if (current === id) setActiveDocument(null)
  }

  const deleteVolume = async (id: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!confirm('Delete this volume? Documents will be unassigned.')) return
    await window.api.vol.delete(id)
    await refreshVolumes()
    await refreshDocuments()
  }

  const moveVol = async (idx: number, direction: -1 | 1): Promise<void> => {
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= volumes.length) return
    const reordered = [...volumes]
    ;[reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]]
    await window.api.vol.reorder(reordered.map((v, i) => ({ id: v.id, sort_order: i })))
    await refreshVolumes()
  }

  const moveDoc = async (items: Document[], idx: number, direction: -1 | 1): Promise<void> => {
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= items.length) return
    const reordered = [...items]
    ;[reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]]
    await window.api.doc.reorder(reordered.map((d, i) => ({ id: d.id, sort_order: i })))
    await refreshDocuments()
  }

  const chaptersInVolume = (volumeId: string): Document[] =>
    documents.filter(d => d.volume_id === volumeId && d.type === 'chapter' && !d.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order)

  const scenesOfChapter = (chapterId: string): Document[] =>
    documents.filter(d => d.parent_id === chapterId && d.type === 'scene')
      .sort((a, b) => a.sort_order - b.sort_order)

  const unassignedChapters = documents.filter(d => !d.volume_id && (d.type === 'chapter' || d.type === 'draft') && !d.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order)

  const MoveBtn = ({ onClick, title, children }: { onClick: (e: React.MouseEvent) => void; title: string; children: React.ReactNode }): React.ReactElement => (
    <button
      className="p-0.5 rounded hover:bg-surface-300 text-ink-muted"
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  )

  return (
    <div className="space-y-1">
      {/* Add Volume button */}
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-xs font-semibold text-ink-faint uppercase tracking-wider">Volumes</span>
        <button className="p-1 rounded hover:bg-surface-200 text-ink-muted" onClick={() => setAddingVolume(true)} title="New Volume">
          <FolderPlus className="w-3.5 h-3.5" />
        </button>
      </div>

      {addingVolume && (
        <div className="flex gap-1 px-1 mb-2">
          <input
            className="input text-xs py-1 flex-1"
            placeholder="Volume name..."
            value={newVolumeName}
            onChange={e => setNewVolumeName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createVolume(); if (e.key === 'Escape') { setAddingVolume(false); setNewVolumeName('') } }}
            autoFocus
          />
        </div>
      )}

      {volumes.map((vol, volIdx) => (
        <div key={vol.id} className="mb-1">
          <div
            className="flex items-center gap-1 px-1 py-1 rounded hover:bg-surface-200 cursor-pointer group"
            onClick={() => toggleVolume(vol.id)}
          >
            {expandedVolumes.has(vol.id)
              ? <ChevronDown className="w-3.5 h-3.5 text-ink-muted shrink-0" />
              : <ChevronRight className="w-3.5 h-3.5 text-ink-muted shrink-0" />}
            <BookMarked className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="flex-1 text-sm font-medium text-ink truncate">{vol.title}</span>
            <div className="hidden group-hover:flex items-center gap-0.5">
              {volIdx > 0 && (
                <MoveBtn onClick={e => { e.stopPropagation(); moveVol(volIdx, -1) }} title="Move up">
                  <ChevronUp className="w-3 h-3" />
                </MoveBtn>
              )}
              {volIdx < volumes.length - 1 && (
                <MoveBtn onClick={e => { e.stopPropagation(); moveVol(volIdx, 1) }} title="Move down">
                  <ChevronDown className="w-3 h-3" />
                </MoveBtn>
              )}
              <button
                className="p-0.5 rounded hover:bg-surface-300 text-ink-muted"
                onClick={e => { e.stopPropagation(); setAddingChapterTo(vol.id); setNewChapterName('') }}
                title="Add Chapter"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                className="p-0.5 rounded hover:bg-red-100 text-ink-muted hover:text-red-500"
                onClick={e => deleteVolume(vol.id, e)}
                title="Delete Volume"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {expandedVolumes.has(vol.id) && (
            <div className="ml-5">
              {addingChapterTo === vol.id && (
                <div className="flex gap-1 px-1 my-1">
                  <input
                    className="input text-xs py-1 flex-1"
                    placeholder="Chapter name..."
                    value={newChapterName}
                    onChange={e => setNewChapterName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') createChapter(vol.id); if (e.key === 'Escape') setAddingChapterTo(null) }}
                    autoFocus
                  />
                </div>
              )}
              {chaptersInVolume(vol.id).map((doc, docIdx, chapArr) => (
                <DocItem
                  key={doc.id}
                  doc={doc}
                  scenes={scenesOfChapter(doc.id)}
                  isExpanded={expandedDocs.has(doc.id)}
                  isActive={activeDocumentId === doc.id}
                  isFirst={docIdx === 0}
                  isLast={docIdx === chapArr.length - 1}
                  onToggle={() => toggleDoc(doc.id)}
                  onSelect={() => setActiveDocument(doc.id)}
                  onDelete={e => deleteDoc(doc.id, e)}
                  onAddScene={() => createScene(doc.id, vol.id)}
                  onMoveUp={() => moveDoc(chapArr, docIdx, -1)}
                  onMoveDown={() => moveDoc(chapArr, docIdx, 1)}
                  onMoveScene={(sceneId, dir) => {
                    const scenes = scenesOfChapter(doc.id)
                    const si = scenes.findIndex(s => s.id === sceneId)
                    moveDoc(scenes, si, dir)
                  }}
                  onSelectScene={id => setActiveDocument(id)}
                  activeDocumentId={activeDocumentId}
                  onDeleteScene={id => deleteDoc(id, { stopPropagation: () => {} } as React.MouseEvent)}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Unassigned docs */}
      {unassignedChapters.length > 0 && (
        <div className="mt-3">
          <div className="px-1 mb-1">
            <span className="text-xs font-semibold text-ink-faint uppercase tracking-wider">Unassigned</span>
          </div>
          {unassignedChapters.map((doc, docIdx, arr) => (
            <DocItem
              key={doc.id}
              doc={doc}
              scenes={[]}
              isExpanded={false}
              isActive={activeDocumentId === doc.id}
              isFirst={docIdx === 0}
              isLast={docIdx === arr.length - 1}
              onToggle={() => {}}
              onSelect={() => setActiveDocument(doc.id)}
              onDelete={e => deleteDoc(doc.id, e)}
              onAddScene={() => {}}
              onMoveUp={() => moveDoc(arr, docIdx, -1)}
              onMoveDown={() => moveDoc(arr, docIdx, 1)}
              onMoveScene={() => {}}
              onSelectScene={() => {}}
              activeDocumentId={activeDocumentId}
              onDeleteScene={() => {}}
            />
          ))}
        </div>
      )}

      {/* Add standalone chapter */}
      <button
        className="w-full flex items-center gap-1.5 px-2 py-1.5 mt-2 text-xs text-ink-muted hover:text-ink hover:bg-surface-200 rounded transition-colors"
        onClick={() => window.api.doc.create({ title: 'New Chapter', type: 'chapter' }).then(() => refreshDocuments())}
      >
        <Plus className="w-3 h-3" />
        Add Chapter
      </button>
    </div>
  )
}

interface DocItemProps {
  doc: Document
  scenes: Document[]
  isExpanded: boolean
  isActive: boolean
  isFirst: boolean
  isLast: boolean
  onToggle: () => void
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
  onAddScene: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onMoveScene: (sceneId: string, direction: -1 | 1) => void
  onSelectScene: (id: string) => void
  activeDocumentId: string | null
  onDeleteScene: (id: string) => void
}

function DocItem({ doc, scenes, isExpanded, isActive, isFirst, isLast, onToggle, onSelect, onDelete, onAddScene, onMoveUp, onMoveDown, onMoveScene, onSelectScene, activeDocumentId, onDeleteScene }: DocItemProps): React.ReactElement {
  return (
    <div>
      <div
        className={`flex items-center gap-1 px-1 py-1 rounded cursor-pointer group ${isActive ? 'bg-accent/10 text-accent' : 'hover:bg-surface-200 text-ink'}`}
        onClick={onSelect}
      >
        {scenes.length > 0
          ? <button onClick={e => { e.stopPropagation(); onToggle() }} className="shrink-0">
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-ink-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-ink-muted" />}
            </button>
          : <div className="w-3.5 h-3.5 shrink-0" />}
        <FileText className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-sm truncate">{doc.title}</span>
        <span className="hidden group-hover:block text-xs text-ink-faint mr-1">{doc.word_count > 0 ? doc.word_count : ''}</span>
        <div className="hidden group-hover:flex items-center gap-0.5">
          {!isFirst && (
            <button className="p-0.5 rounded hover:bg-surface-300 text-ink-muted" onClick={e => { e.stopPropagation(); onMoveUp() }} title="Move up">
              <ChevronUp className="w-3 h-3" />
            </button>
          )}
          {!isLast && (
            <button className="p-0.5 rounded hover:bg-surface-300 text-ink-muted" onClick={e => { e.stopPropagation(); onMoveDown() }} title="Move down">
              <ChevronDown className="w-3 h-3" />
            </button>
          )}
          <button className="p-0.5 rounded hover:bg-surface-300 text-ink-muted" onClick={e => { e.stopPropagation(); onAddScene() }} title="Add Scene">
            <Plus className="w-3 h-3" />
          </button>
          <button className="p-0.5 rounded hover:bg-red-100 text-ink-muted hover:text-red-500" onClick={onDelete} title="Delete">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      {isExpanded && scenes.map((scene, sceneIdx) => (
        <div
          key={scene.id}
          className={`flex items-center gap-1 ml-5 px-1 py-0.5 rounded cursor-pointer group ${activeDocumentId === scene.id ? 'bg-accent/10 text-accent' : 'hover:bg-surface-200 text-ink-muted'}`}
          onClick={() => onSelectScene(scene.id)}
        >
          <div className="w-3.5 h-3.5 shrink-0" />
          <FileText className="w-3 h-3 shrink-0" />
          <span className="flex-1 text-xs truncate">{scene.title}</span>
          <div className="hidden group-hover:flex items-center gap-0.5">
            {sceneIdx > 0 && (
              <button className="p-0.5 rounded hover:bg-surface-300 text-ink-muted" onClick={e => { e.stopPropagation(); onMoveScene(scene.id, -1) }} title="Move up">
                <ChevronUp className="w-3 h-3" />
              </button>
            )}
            {sceneIdx < scenes.length - 1 && (
              <button className="p-0.5 rounded hover:bg-surface-300 text-ink-muted" onClick={e => { e.stopPropagation(); onMoveScene(scene.id, 1) }} title="Move down">
                <ChevronDown className="w-3 h-3" />
              </button>
            )}
            <button className="p-0.5 rounded hover:bg-red-100 text-ink-muted hover:text-red-500" onClick={e => { e.stopPropagation(); onDeleteScene(scene.id) }} title="Delete scene">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
