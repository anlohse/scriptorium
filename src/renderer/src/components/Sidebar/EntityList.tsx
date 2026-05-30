import React, { useState } from 'react'
import { Plus, FolderPlus, Trash2, ChevronRight, ChevronDown, Folder, FolderOpen, MoveRight, Pencil, X } from 'lucide-react'
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

// ─── Tree helpers ─────────────────────────────────────────────────────────────

interface TreeNode {
  item: Entity
  children: TreeNode[]
}

function buildTree(items: Entity[]): TreeNode[] {
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
      return a.item.name.localeCompare(b.item.name)
    })
    nodes.forEach(n => sort(n.children))
  }
  sort(roots)
  return roots
}

function collectFolders(nodes: TreeNode[], excludeId?: string): Entity[] {
  const result: Entity[] = []
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

// ─── Move picker ──────────────────────────────────────────────────────────────

function EntityMovePicker({ movingId, folders, currentParentId, onSelect, onClose }: {
  movingId: string
  folders: Entity[]
  currentParentId: string | null
  onSelect: (parentId: string | null) => void
  onClose: () => void
}): React.ReactElement {
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
              {f.name}
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

// ─── Entity type section ──────────────────────────────────────────────────────

interface TypeSectionProps {
  type: EntityType
  entities: Entity[]
  collapsed: Set<string>
  toggleCollapse: (id: string) => void
  sectionCollapsed: boolean
  onToggleSection: () => void
  activeEntityId: string | null
  onSelect: (entity: Entity) => void
  onDelete: (id: string, isFolder: boolean) => Promise<void>
  onMove: (id: string, currentParentId: string | null, type: EntityType, isFolder: boolean) => void
  onAddEntity: (type: EntityType, parentId: string | null) => void
  onAddFolder: (type: EntityType, parentId: string | null) => void
  renaming: { id: string; name: string } | null
  setRenaming: (r: { id: string; name: string } | null) => void
  onConfirmRename: (id: string) => Promise<void>
  adding: { type: EntityType; parentId: string | null; isFolder: boolean } | null
  newName: string
  setNewName: (s: string) => void
  onConfirmAdd: () => Promise<void>
  onCancelAdd: () => void
}

function TypeSection({
  type, entities, collapsed, toggleCollapse,
  sectionCollapsed, onToggleSection,
  activeEntityId, onSelect, onDelete, onMove,
  onAddEntity, onAddFolder,
  renaming, setRenaming, onConfirmRename,
  adding, newName, setNewName, onConfirmAdd, onCancelAdd
}: TypeSectionProps): React.ReactElement {
  const tree = buildTree(entities)
  const allFolders = collectFolders(tree)
  const color = TYPE_COLORS[type]

  const renderAddInput = (parentId: string | null, isFolder: boolean): React.ReactElement | null => {
    if (!adding || adding.type !== type || adding.parentId !== parentId || adding.isFolder !== isFolder) return null
    return (
      <div className="pl-2 pr-1 mt-0.5 mb-0.5">
        <input
          className="input text-xs py-1 w-full"
          placeholder={isFolder ? 'Folder name…' : `New ${type}…`}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onConfirmAdd(); if (e.key === 'Escape') onCancelAdd() }}
          autoFocus
        />
      </div>
    )
  }

  const renderNode = (node: TreeNode, siblings: TreeNode[], idx: number, depth: number): React.ReactElement => {
    const entity = node.item
    const isActive = activeEntityId === entity.id
    const isCollapsed = collapsed.has(entity.id)
    const indent = { paddingLeft: `${depth * 14 + 8}px` }

    if (entity.is_folder) {
      const isRenaming = renaming?.id === entity.id
      return (
        <div key={entity.id}>
          <div
            style={indent}
            className="flex items-center gap-1.5 py-1 rounded cursor-pointer group hover:bg-surface-200 text-ink pr-1"
            onClick={() => toggleCollapse(entity.id)}
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
                value={renaming.name}
                onChange={e => setRenaming({ id: entity.id, name: e.target.value })}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.stopPropagation(); onConfirmRename(entity.id) }
                  if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null) }
                }}
                onClick={e => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span className="flex-1 text-sm truncate font-medium">{entity.name}</span>
            )}
            {!isRenaming && (
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button className="p-0.5 rounded hover:bg-surface-300 text-ink-muted" title="Add entity inside" onClick={e => { e.stopPropagation(); onAddEntity(type, entity.id) }}><Plus className="w-3 h-3" /></button>
                <button className="p-0.5 rounded hover:bg-surface-300 text-ink-muted" title="Add subfolder" onClick={e => { e.stopPropagation(); onAddFolder(type, entity.id) }}><FolderPlus className="w-3 h-3" /></button>
                <button className="p-0.5 rounded hover:bg-surface-300 text-ink-muted" title="Rename" onClick={e => { e.stopPropagation(); setRenaming({ id: entity.id, name: entity.name }) }}><Pencil className="w-3 h-3" /></button>
                {allFolders.filter(f => f.id !== entity.id).length > 0 && (
                  <button className="p-0.5 rounded hover:bg-surface-300 text-ink-muted" title="Move to folder" onClick={e => { e.stopPropagation(); onMove(entity.id, entity.parent_id, type, true) }}><MoveRight className="w-3 h-3" /></button>
                )}
                <button className="p-0.5 rounded hover:bg-red-100 text-ink-muted hover:text-red-500" title="Delete folder" onClick={e => { e.stopPropagation(); onDelete(entity.id, true) }}><Trash2 className="w-3 h-3" /></button>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <div>
              {renderAddInput(entity.id, true)}
              {renderAddInput(entity.id, false)}
              {node.children.map((child, ci) => renderNode(child, node.children, ci, depth + 1))}
              {node.children.length === 0 && adding?.parentId !== entity.id && (
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
        key={entity.id}
        style={indent}
        className={`flex items-center gap-2 py-1.5 rounded cursor-pointer group pr-1 ${isActive ? 'bg-accent/10' : 'hover:bg-surface-200'}`}
        onClick={() => onSelect(entity)}
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
        <span className={`flex-1 text-sm truncate ${isActive ? 'text-accent font-medium' : 'text-ink'}`}>{entity.name}</span>
        <div className="hidden group-hover:flex items-center gap-0.5">
          {allFolders.length > 0 && (
            <button className="p-0.5 rounded hover:bg-surface-300 text-ink-muted" title="Move to folder" onClick={e => { e.stopPropagation(); onMove(entity.id, entity.parent_id, type, false) }}><MoveRight className="w-3 h-3" /></button>
          )}
          <button className="p-0.5 rounded hover:bg-red-100 text-ink-muted hover:text-red-500" onClick={e => { e.stopPropagation(); onDelete(entity.id, false) }}><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>
    )
  }

  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1) + 's'

  return (
    <div className="mb-3">
      <div
        className="flex items-center justify-between px-1 py-0.5 cursor-pointer group"
        onClick={onToggleSection}
      >
        <div className="flex items-center gap-1">
          {sectionCollapsed
            ? <ChevronRight className="w-3 h-3 text-ink-faint" />
            : <ChevronDown className="w-3 h-3 text-ink-faint" />}
          <div className={`w-2 h-2 rounded-full ${color}`} />
          <span className="text-xs font-semibold text-ink-faint uppercase tracking-wider">{typeLabel}</span>
        </div>
        {!sectionCollapsed && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="p-1 rounded hover:bg-surface-200 text-ink-muted" title="New folder" onClick={e => { e.stopPropagation(); onAddFolder(type, null) }}><FolderPlus className="w-3 h-3" /></button>
            <button className="p-1 rounded hover:bg-surface-200 text-ink-muted" title={`New ${type}`} onClick={e => { e.stopPropagation(); onAddEntity(type, null) }}><Plus className="w-3 h-3" /></button>
          </div>
        )}
      </div>
      {!sectionCollapsed && (
        <div>
          {renderAddInput(null, true)}
          {renderAddInput(null, false)}
          {tree.map((node, idx) => renderNode(node, tree, idx, 0))}
          {entities.length === 0 && !adding && (
            <p className="text-xs text-ink-faint px-2 py-1">No {type}s yet</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EntityList(): React.ReactElement {
  const { entities, refreshEntities } = useProjectStore()
  const { activeEntityId, setActiveEntity } = useUIStore()

  const [filter, setFilter] = useState<EntityType | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<EntityType>('character')
  const [formParentId, setFormParentId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [sectionCollapsed, setSectionCollapsed] = useState<Set<EntityType>>(new Set())
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [moving, setMoving] = useState<{ id: string; currentParentId: string | null; type: EntityType; isFolder: boolean } | null>(null)
  const [adding, setAdding] = useState<{ type: EntityType; parentId: string | null; isFolder: boolean } | null>(null)
  const [newName, setNewName] = useState('')

  const toggleCollapse = (id: string): void => {
    setCollapsed(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const toggleSection = (type: EntityType): void => {
    setSectionCollapsed(prev => { const s = new Set(prev); s.has(type) ? s.delete(type) : s.add(type); return s })
  }

  const onAddEntity = (type: EntityType, parentId: string | null): void => {
    if (parentId) setCollapsed(prev => { const s = new Set(prev); s.delete(parentId); return s })
    setFormType(type)
    setFormParentId(parentId)
    setShowForm(true)
  }

  const onAddFolder = (type: EntityType, parentId: string | null): void => {
    if (parentId) setCollapsed(prev => { const s = new Set(prev); s.delete(parentId); return s })
    setAdding({ type, parentId, isFolder: true })
    setNewName('')
  }

  const onConfirmAdd = async (): Promise<void> => {
    if (!adding || !newName.trim()) { setAdding(null); return }
    const typeEntities = entities.filter(e => e.type === adding.type && (e.parent_id ?? null) === adding.parentId && e.is_folder)
    await window.api.entity.create({
      name: newName.trim(),
      type: adding.type,
      parent_id: adding.parentId,
      is_folder: 1,
      sort_order: typeEntities.length,
      summary: '',
      description: '',
      tags: [],
      aliases: []
    } as Record<string, unknown>)
    setNewName('')
    setAdding(null)
    await refreshEntities()
  }

  const onCancelAdd = (): void => { setAdding(null); setNewName('') }

  const onConfirmRename = async (id: string): Promise<void> => {
    if (!renaming || !renaming.name.trim()) { setRenaming(null); return }
    await window.api.entity.update(id, { name: renaming.name.trim() })
    setRenaming(null)
    await refreshEntities()
  }

  const onDelete = async (id: string, isFolder: boolean): Promise<void> => {
    const msg = isFolder
      ? 'Delete this folder? It must be empty.'
      : 'Delete this entity? All related data will be removed.'
    if (!confirm(msg)) return
    const res = await window.api.entity.delete(id)
    if (!res.success && res.error) { alert(res.error); return }
    await refreshEntities()
    if (useUIStore.getState().activeEntityId === id) setActiveEntity(null)
  }

  const onSelect = (entity: Entity): void => {
    setActiveEntity(entity.id)
    useUIStore.getState().setInspectorOpen(true)
  }

  const onMove = (id: string, currentParentId: string | null, type: EntityType, isFolder: boolean): void => {
    setMoving({ id, currentParentId, type, isFolder })
  }

  const handleMovePick = async (newParentId: string | null): Promise<void> => {
    if (!moving) return
    setMoving(null)
    const res = await window.api.entity.move(moving.id, newParentId)
    if (!res.success && res.error) { alert(res.error); return }
    await refreshEntities()
  }

  const typesToShow = filter === 'all' ? ENTITY_TYPES : [filter as EntityType]

  const movingFolders = moving
    ? collectFolders(buildTree(entities.filter(e => e.type === moving.type)), moving.isFolder ? moving.id : undefined)
    : []

  const sharedProps = {
    collapsed, toggleCollapse,
    activeEntityId, onSelect, onDelete, onMove,
    onAddEntity, onAddFolder,
    renaming, setRenaming, onConfirmRename,
    adding, newName, setNewName, onConfirmAdd, onCancelAdd
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-ink-faint uppercase tracking-wider">Entities</span>
        <button className="p-1 rounded hover:bg-surface-200 text-ink-muted" onClick={() => { setFormType('character'); setFormParentId(null); setShowForm(true) }} title="New Entity">
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
        {ENTITY_TYPES.map(t => (
          <button
            key={t}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors capitalize ${filter === t ? 'bg-ink text-white border-ink' : 'border-surface-300 text-ink-muted hover:border-ink-muted'}`}
            onClick={() => setFilter(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {typesToShow.map(type => (
        <TypeSection
          key={type}
          type={type}
          entities={entities.filter(e => e.type === type)}
          sectionCollapsed={filter !== 'all' ? false : sectionCollapsed.has(type)}
          onToggleSection={() => filter !== 'all' ? null : toggleSection(type)}
          {...sharedProps}
        />
      ))}

      {showForm && (
        <EntityForm
          initialType={formType}
          onSave={async (data) => {
            await window.api.entity.create({ ...data, parent_id: formParentId } as Record<string, unknown>)
            await refreshEntities()
            setShowForm(false)
            setFormParentId(null)
          }}
          onClose={() => { setShowForm(false); setFormParentId(null) }}
        />
      )}

      {moving && (
        <EntityMovePicker
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
