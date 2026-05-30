import React, { useState, useRef, useEffect } from 'react'
import {
  Plus, FolderPlus, FileText, BookOpen, Trash2, ChevronRight, ChevronDown,
  Folder, FolderOpen, MoveRight, Pencil, X, Check
} from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import { useUIStore } from '../../stores/uiStore'
import type { Document } from '../../types'

// ─── Tree helpers ────────────────────────────────────────────────────────────

interface TreeNode {
  item: Document
  children: TreeNode[]
}

function buildTree(items: Document[]): TreeNode[] {
  const byId = new Map(items.map(i => [i.id, { item: i, children: [] as TreeNode[] }]))
  const roots: TreeNode[] = []
  for (const item of items) {
    const node = byId.get(item.id)!
    if (item.parent_id && byId.has(item.parent_id)) {
      byId.get(item.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.item.is_folder !== b.item.is_folder) return b.item.is_folder - a.item.is_folder
      if (a.item.sort_order !== b.item.sort_order) return a.item.sort_order - b.item.sort_order
      return a.item.title.localeCompare(b.item.title)
    })
    nodes.forEach(n => sort(n.children))
  }
  sort(roots)
  return roots
}

function collectFolders(nodes: TreeNode[], excludeId?: string): Document[] {
  const result: Document[] = []
  const walk = (ns: TreeNode[]) => {
    for (const n of ns) {
      if (n.item.is_folder && n.item.id !== excludeId) {
        result.push(n.item)
        walk(n.children)
      }
    }
  }
  walk(nodes)
  return result
}

function getSiblings(tree: TreeNode[], parentId: string | null): TreeNode[] {
  if (parentId === null) return tree
  const find = (nodes: TreeNode[]): TreeNode[] | null => {
    for (const n of nodes) {
      if (n.item.id === parentId) return n.children
      const found = find(n.children)
      if (found) return found
    }
    return null
  }
  return find(tree) ?? []
}

// ─── Move picker modal ────────────────────────────────────────────────────────

interface MovePickerProps {
  movingId: string
  folders: Document[]
  currentParentId: string | null
  onSelect: (parentId: string | null) => void
  onClose: () => void
}

function MovePicker({ movingId, folders, currentParentId, onSelect, onClose }: MovePickerProps): React.ReactElement {
  return (
    <div className="fixed inset-0 bg-black/25 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-64 p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-ink">Move to…</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-100 text-ink-muted"><X className="w-3.5 h-3.5" /></button>
        </div>
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          <button
            className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-surface-100 ${currentParentId === null ? 'text-ink-faint' : 'text-ink'}`}
            onClick={() => onSelect(null)}
            disabled={currentParentId === null}
          >
            Root
          </button>
          {folders.filter(f => f.id !== movingId).map(f => (
            <button
              key={f.id}
              className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-surface-100 flex items-center gap-2 ${currentParentId === f.id ? 'text-ink-faint' : 'text-ink'}`}
              onClick={() => onSelect(f.id)}
              disabled={currentParentId === f.id}
            >
              <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              {f.title}
            </button>
          ))}
          {folders.length === 0 && (
            <p className="text-xs text-ink-faint px-3 py-2">No folders available</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

interface SectionProps {
  label: string
  docType: 'note' | 'lore'
  tree: TreeNode[]
  allDocs: Document[]
  collapsed: Set<string>
  toggleCollapse: (id: string) => void
  activeDocumentId: string | null
  setActiveDocument: (id: string | null) => void
  onCreate: (type: 'note' | 'lore', parentId: string | null) => void
  onCreateFolder: (type: 'note' | 'lore', parentId: string | null) => void
  onDelete: (id: string, isFolder: boolean) => Promise<void>
  onMove: (id: string, currentParentId: string | null, type: 'note' | 'lore', isFolder: boolean) => void
  onRename: (id: string) => void
  onReorder: (siblings: TreeNode[], idx: number, direction: -1 | 1) => Promise<void>
  adding: { type: 'note' | 'lore'; parentId: string | null; isFolder: boolean } | null
  newName: string
  setNewName: (s: string) => void
  confirmAdd: () => Promise<void>
  cancelAdd: () => void
  renaming: { id: string; title: string } | null
  setRenaming: (r: { id: string; title: string } | null) => void
  confirmRename: (id: string) => Promise<void>
}

function Section({
  label, docType, tree, allDocs, collapsed, toggleCollapse,
  activeDocumentId, setActiveDocument,
  onCreate, onCreateFolder, onDelete, onMove, onRename, onReorder,
  adding, newName, setNewName, confirmAdd, cancelAdd,
  renaming, setRenaming, confirmRename
}: SectionProps): React.ReactElement {
  const allFolders = collectFolders(tree)
  const Icon = docType === 'lore' ? BookOpen : FileText

  const renderAddInput = (parentId: string | null, isFolder: boolean): React.ReactElement | null => {
    if (!adding || adding.type !== docType || adding.parentId !== parentId || adding.isFolder !== isFolder) return null
    return (
      <div className="px-1 mb-1 mt-1">
        <input
          className="input text-xs py-1 w-full"
          placeholder={isFolder ? 'Folder name…' : `New ${label.toLowerCase()}…`}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') cancelAdd() }}
          autoFocus
        />
      </div>
    )
  }

  const renderNode = (node: TreeNode, siblings: TreeNode[], idx: number, depth: number): React.ReactElement => {
    const doc = node.item
    const isCollapsed = collapsed.has(doc.id)
    const isActive = activeDocumentId === doc.id
    const indent = { paddingLeft: `${depth * 14 + 8}px` }

    if (doc.is_folder) {
      const isRenaming = renaming?.id === doc.id
      return (
        <div key={doc.id}>
          <div
            style={indent}
            className={`flex items-center gap-1.5 py-1 rounded cursor-pointer group hover:bg-surface-200 text-ink pr-2`}
            onClick={() => toggleCollapse(doc.id)}
          >
            {isCollapsed
              ? <ChevronRight className="w-3 h-3 shrink-0 text-ink-faint" />
              : <ChevronDown className="w-3 h-3 shrink-0 text-ink-faint" />}
            {isCollapsed
              ? <Folder className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              : <FolderOpen className="w-3.5 h-3.5 shrink-0 text-amber-500" />}
            {isRenaming ? (
              <input
                className="input text-xs py-0.5 flex-1 min-w-0"
                value={renaming.title}
                onChange={e => setRenaming({ id: doc.id, title: e.target.value })}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.stopPropagation(); confirmRename(doc.id) }
                  if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null) }
                }}
                onClick={e => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span className="flex-1 text-sm truncate font-medium">{doc.title}</span>
            )}
            {!isRenaming && (
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button
                  className="p-0.5 rounded hover:bg-surface-300 text-ink-muted"
                  onClick={e => { e.stopPropagation(); onCreate(docType, doc.id) }}
                  title={`Add ${label.toLowerCase()} inside`}
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  className="p-0.5 rounded hover:bg-surface-300 text-ink-muted"
                  onClick={e => { e.stopPropagation(); onCreateFolder(docType, doc.id) }}
                  title="Add subfolder"
                >
                  <FolderPlus className="w-3 h-3" />
                </button>
                <button
                  className="p-0.5 rounded hover:bg-surface-300 text-ink-muted"
                  onClick={e => { e.stopPropagation(); setRenaming({ id: doc.id, title: doc.title }) }}
                  title="Rename"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                {idx > 0 && (
                  <button className="p-0.5 rounded hover:bg-surface-300 text-ink-muted" onClick={e => { e.stopPropagation(); onReorder(siblings, idx, -1) }} title="Move up">
                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor"><path d="M6 2l4 5H2z" /></svg>
                  </button>
                )}
                {idx < siblings.length - 1 && (
                  <button className="p-0.5 rounded hover:bg-surface-300 text-ink-muted" onClick={e => { e.stopPropagation(); onReorder(siblings, idx, 1) }} title="Move down">
                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor"><path d="M6 10L2 5h8z" /></svg>
                  </button>
                )}
                <button
                  className="p-0.5 rounded hover:bg-red-100 text-ink-muted hover:text-red-500"
                  onClick={e => { e.stopPropagation(); onDelete(doc.id, true) }}
                  title="Delete folder"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <div>
              {renderAddInput(doc.id, true)}
              {renderAddInput(doc.id, false)}
              {node.children.map((child, ci) => renderNode(child, node.children, ci, depth + 1))}
              {node.children.length === 0 && adding?.parentId !== doc.id && (
                <div style={{ paddingLeft: `${(depth + 1) * 14 + 8}px` }}>
                  <p className="text-xs text-ink-faint py-0.5">Empty folder</p>
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    return (
      <div
        key={doc.id}
        style={indent}
        className={`flex items-center gap-1.5 py-1 rounded cursor-pointer group pr-2 ${isActive ? 'bg-accent/10 text-accent' : 'hover:bg-surface-200 text-ink'}`}
        onClick={() => setActiveDocument(doc.id)}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-sm truncate">{doc.title}</span>
        <div className="hidden group-hover:flex items-center gap-0.5">
          {idx > 0 && (
            <button className="p-0.5 rounded hover:bg-surface-300 text-ink-muted" onClick={e => { e.stopPropagation(); onReorder(siblings, idx, -1) }} title="Move up">
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor"><path d="M6 2l4 5H2z" /></svg>
            </button>
          )}
          {idx < siblings.length - 1 && (
            <button className="p-0.5 rounded hover:bg-surface-300 text-ink-muted" onClick={e => { e.stopPropagation(); onReorder(siblings, idx, 1) }} title="Move down">
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor"><path d="M6 10L2 5h8z" /></svg>
            </button>
          )}
          {allFolders.length > 0 && (
            <button
              className="p-0.5 rounded hover:bg-surface-300 text-ink-muted"
              onClick={e => { e.stopPropagation(); onMove(doc.id, doc.parent_id, docType, false) }}
              title="Move to folder"
            >
              <MoveRight className="w-3 h-3" />
            </button>
          )}
          <button className="p-0.5 rounded hover:bg-red-100 text-ink-muted hover:text-red-500" onClick={e => { e.stopPropagation(); onDelete(doc.id, false) }} title="Delete">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    )
  }

  const rootItems = tree
  const isEmpty = allDocs.filter(d => d.type === docType).length === 0

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-xs font-semibold text-ink-faint uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-0.5">
          <button className="p-1 rounded hover:bg-surface-200 text-ink-muted" onClick={() => onCreateFolder(docType, null)} title="New folder">
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 rounded hover:bg-surface-200 text-ink-muted" onClick={() => onCreate(docType, null)} title={`New ${label.toLowerCase()}`}>
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {renderAddInput(null, true)}
      {renderAddInput(null, false)}
      {rootItems.map((node, idx) => renderNode(node, rootItems, idx, 0))}
      {isEmpty && !adding && (
        <p className="text-xs text-ink-faint px-2 py-1">No {label.toLowerCase()} yet</p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NotesTree(): React.ReactElement {
  const { documents, refreshDocuments } = useProjectStore()
  const { activeDocumentId, setActiveDocument } = useUIStore()

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<{ type: 'note' | 'lore'; parentId: string | null; isFolder: boolean } | null>(null)
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null)
  const [moving, setMoving] = useState<{ id: string; currentParentId: string | null; type: 'note' | 'lore'; isFolder: boolean } | null>(null)

  const notes = documents.filter(d => d.type === 'note')
  const lore = documents.filter(d => d.type === 'lore')
  const notesTree = buildTree(notes)
  const loreTree = buildTree(lore)

  const toggleCollapse = (id: string): void => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const onCreate = (type: 'note' | 'lore', parentId: string | null): void => {
    setAdding({ type, parentId, isFolder: false })
    setNewName('')
    // Auto-expand parent
    if (parentId) setCollapsed(prev => { const s = new Set(prev); s.delete(parentId); return s })
  }

  const onCreateFolder = (type: 'note' | 'lore', parentId: string | null): void => {
    setAdding({ type, parentId, isFolder: true })
    setNewName('')
    if (parentId) setCollapsed(prev => { const s = new Set(prev); s.delete(parentId); return s })
  }

  const confirmAdd = async (): Promise<void> => {
    if (!adding || !newName.trim()) { setAdding(null); return }
    const doc = await window.api.doc.create({
      title: newName.trim(),
      type: adding.type,
      parent_id: adding.parentId ?? undefined,
      is_folder: adding.isFolder || undefined
    })
    setNewName('')
    setAdding(null)
    await refreshDocuments()
    if (!adding.isFolder) setActiveDocument(doc.id)
  }

  const cancelAdd = (): void => { setAdding(null); setNewName('') }

  const confirmRename = async (id: string): Promise<void> => {
    if (!renaming || !renaming.title.trim()) { setRenaming(null); return }
    await window.api.doc.update(id, { title: renaming.title.trim() })
    setRenaming(null)
    await refreshDocuments()
  }

  const onDelete = async (id: string, isFolder: boolean): Promise<void> => {
    const msg = isFolder
      ? 'Delete this folder? It must be empty.'
      : 'Delete this document?'
    if (!confirm(msg)) return
    const res = await window.api.doc.delete(id)
    if (!res.success && res.error) {
      alert(res.error)
      return
    }
    await refreshDocuments()
    if (useUIStore.getState().activeDocumentId === id) setActiveDocument(null)
  }

  const onMove = (id: string, currentParentId: string | null, type: 'note' | 'lore', isFolder: boolean): void => {
    setMoving({ id, currentParentId, type, isFolder })
  }

  const handleMovePick = async (newParentId: string | null): Promise<void> => {
    if (!moving) return
    setMoving(null)
    const res = await window.api.doc.move(moving.id, newParentId)
    if (!res.success && res.error) { alert(res.error); return }
    await refreshDocuments()
  }

  const onReorder = async (siblings: TreeNode[], idx: number, direction: -1 | 1): Promise<void> => {
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= siblings.length) return
    const reordered = [...siblings]
    ;[reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]]
    await window.api.doc.reorder(reordered.map((n, i) => ({ id: n.item.id, sort_order: i })))
    await refreshDocuments()
  }

  const movingType = moving?.type ?? 'note'
  const movingTree = movingType === 'note' ? notesTree : loreTree
  const movingFolders = moving
    ? collectFolders(movingTree, moving.isFolder ? moving.id : undefined)
    : []

  const sharedProps = {
    adding, newName, setNewName, confirmAdd, cancelAdd,
    collapsed, toggleCollapse,
    activeDocumentId, setActiveDocument,
    onCreate, onCreateFolder, onDelete, onMove, onRename: (id: string) => {
      const doc = documents.find(d => d.id === id)
      if (doc) setRenaming({ id, title: doc.title })
    },
    onReorder,
    renaming, setRenaming, confirmRename
  }

  return (
    <div>
      <Section label="Notes" docType="note" tree={notesTree} allDocs={documents} {...sharedProps} />
      <Section label="Lore" docType="lore" tree={loreTree} allDocs={documents} {...sharedProps} />

      {moving && (
        <MovePicker
          movingId={moving.id}
          folders={movingFolders}
          currentParentId={moving.currentParentId}
          onSelect={handleMovePick}
          onClose={() => setMoving(null)}
        />
      )}
    </div>
  )
}
