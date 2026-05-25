import React, { useEffect, useState, useCallback, useRef } from 'react'
import { marked } from 'marked'
import { useProjectStore } from '../../stores/projectStore'
import { useUIStore } from '../../stores/uiStore'
import { RelationForm } from '../Entities/RelationForm'
import type { Entity, Relation, Mention, EntityFrontmatter } from '../../types'
import { Edit2, Eye, Pin, PinOff, Plus, Trash2 } from 'lucide-react'

const TYPE_BADGE: Record<string, string> = {
  character: 'tag-character',
  location: 'tag-location',
  event: 'tag-event',
  faction: 'tag-faction',
  item: 'tag-item',
  concept: 'tag-concept'
}

// Simple YAML frontmatter parser
function parseFrontmatter(content: string): { meta: EntityFrontmatter; body: string } {
  if (!content.startsWith('---')) return { meta: {}, body: content }
  const end = content.indexOf('\n---', 3)
  if (end === -1) return { meta: {}, body: content }
  const yamlStr = content.slice(4, end)
  const body = content.slice(end + 4).trimStart()
  const meta: EntityFrontmatter = {}
  for (const line of yamlStr.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const val = line.slice(colonIdx + 1).trim()
    if (val) meta[key] = val
  }
  // Parse list items from subsequent lines (simple approach: look for - items)
  let currentKey: string | null = null
  for (const line of yamlStr.split('\n')) {
    if (line.match(/^\s*-\s+(.+)/)) {
      if (currentKey) {
        const existing = meta[currentKey]
        const item = line.match(/^\s*-\s+(.+)/)![1]
        meta[currentKey] = Array.isArray(existing) ? [...existing, item] : [item]
      }
    } else {
      const colonIdx = line.indexOf(':')
      if (colonIdx > -1) {
        const val = line.slice(colonIdx + 1).trim()
        currentKey = val === '' ? line.slice(0, colonIdx).trim() : null
      }
    }
  }
  return { meta, body }
}

function buildFrontmatter(entity: Entity, extraMeta: EntityFrontmatter): string {
  const lines = ['---']
  lines.push(`type: ${entity.type}`)
  if (entity.aliases.length) {
    lines.push('aliases:')
    entity.aliases.forEach(a => lines.push(`  - ${a}`))
  }
  if (entity.tags.length) {
    lines.push('tags:')
    entity.tags.forEach(t => lines.push(`  - ${t}`))
  }
  for (const [k, v] of Object.entries(extraMeta)) {
    if (k === 'type' || k === 'aliases' || k === 'tags') continue
    if (Array.isArray(v)) {
      lines.push(`${k}:`)
      v.forEach(i => lines.push(`  - ${i}`))
    } else {
      lines.push(`${k}: ${v}`)
    }
  }
  lines.push('---')
  return lines.join('\n') + '\n\n'
}

// Configure marked for safety
marked.setOptions({ breaks: true })

function renderMarkdownWithLinks(body: string, onEntityClick: (name: string) => void): string {
  // Replace [[Entity]] with special anchors before rendering
  const withLinks = body.replace(/\[\[([^\]]+)\]\]/g, '<a href="#" class="entity-link" data-entity="$1">[[$1]]</a>')
  return marked.parse(withLinks) as string
}

interface Props {
  entity: Entity
}

export function EntityInspector({ entity }: Props): React.ReactElement {
  const { refreshEntities, upsertEntity, entities } = useProjectStore()
  const { setActiveEntity, pinnedEntityId, setPinnedEntity } = useUIStore()
  const [relations, setRelations] = useState<Relation[]>([])
  const [mentions, setMentions] = useState<Mention[]>([])
  const [mode, setMode] = useState<'view' | 'edit' | 'meta'>('view')
  const [body, setBody] = useState('')
  const [rawBody, setRawBody] = useState('')
  const [frontmeta, setFrontmeta] = useState<EntityFrontmatter>({})
  const [showRelationForm, setShowRelationForm] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [metaForm, setMetaForm] = useState({ name: entity.name, summary: entity.summary, aliases: entity.aliases.join(', ') })
  const viewRef = useRef<HTMLDivElement>(null)
  const isPinned = pinnedEntityId === entity.id

  useEffect(() => {
    setMetaForm({ name: entity.name, summary: entity.summary, aliases: entity.aliases.join(', ') })
    loadData()
  }, [entity.id])

  const loadData = async (): Promise<void> => {
    const [rels, ments, bodyContent] = await Promise.all([
      window.api.entity.getRelations(entity.id),
      window.api.entity.getMentions(entity.id),
      window.api.entity.getBody(entity.id)
    ])
    setRelations(rels)
    setMentions(ments)
    const { meta, body: parsedBody } = parseFrontmatter(bodyContent)
    setFrontmeta(meta)
    setRawBody(bodyContent || `# ${entity.name}\n\n`)
    setBody(parsedBody || '')
  }

  const handleEntityLinkClick = useCallback((e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('.entity-link') as HTMLAnchorElement | null
    if (!target) return
    e.preventDefault()
    const name = target.getAttribute('data-entity')
    if (!name) return
    const found = entities.find(en => en.name.toLowerCase() === name.toLowerCase())
    if (found) setActiveEntity(found.id)
  }, [entities, setActiveEntity])

  useEffect(() => {
    const el = viewRef.current
    if (!el) return
    el.addEventListener('click', handleEntityLinkClick)
    return () => el.removeEventListener('click', handleEntityLinkClick)
  }, [handleEntityLinkClick])

  const saveBody = async (): Promise<void> => {
    const newContent = buildFrontmatter(entity, frontmeta) + body
    await window.api.entity.saveBody(entity.id, newContent)
    setRawBody(newContent)
    setIsDirty(false)
    setMode('view')
  }

  const saveMeta = async (): Promise<void> => {
    const updated = await window.api.entity.update(entity.id, {
      name: metaForm.name,
      summary: metaForm.summary,
      aliases: metaForm.aliases.split(',').map(s => s.trim()).filter(Boolean)
    })
    if (updated) upsertEntity(updated)
    setMode('view')
  }

  const deleteRelation = async (id: string): Promise<void> => {
    await window.api.relation.delete(id)
    await loadData()
  }

  const renderedHtml = renderMarkdownWithLinks(body, () => {})

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-surface-200 bg-surface-50 flex-shrink-0">
        <div className="flex items-center gap-1.5 mb-1">
          <h3 className="font-semibold text-ink text-sm flex-1 truncate">{entity.name}</h3>
          <span className={`tag capitalize text-[10px] px-1.5 py-0.5 ${TYPE_BADGE[entity.type] || 'tag'}`}>{entity.type}</span>
          <button
            className={`p-1 rounded hover:bg-surface-200 ${isPinned ? 'text-accent' : 'text-ink-faint'}`}
            onClick={() => setPinnedEntity(isPinned ? null : entity.id)}
            title={isPinned ? 'Unpin entity' : 'Pin entity (keep visible while editing)'}
          >
            {isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-0.5">
          {(['view', 'edit', 'meta'] as const).map(m => (
            <button
              key={m}
              onClick={() => { if (m === 'edit' && mode !== 'edit') { setBody(parseFrontmatter(rawBody).body); setIsDirty(false) } setMode(m) }}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${mode === m ? 'bg-accent text-white' : 'text-ink-muted hover:bg-surface-200'}`}
            >
              {m === 'view' ? <span className="flex items-center gap-1"><Eye className="w-3 h-3" />View</span>
               : m === 'edit' ? <span className="flex items-center gap-1"><Edit2 className="w-3 h-3" />Edit</span>
               : 'Metadata'}
            </button>
          ))}
          {isDirty && mode === 'edit' && (
            <button onClick={saveBody} className="ml-auto text-[10px] px-2 py-0.5 rounded bg-accent text-white hover:bg-accent/80">Save</button>
          )}
          {mode === 'meta' && (
            <button onClick={saveMeta} className="ml-auto text-[10px] px-2 py-0.5 rounded bg-accent text-white hover:bg-accent/80">Save</button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {mode === 'view' && (
          <div
            ref={viewRef}
            className="prose-entity p-4"
            dangerouslySetInnerHTML={{ __html: renderedHtml || '<p class="text-ink-faint text-sm italic">No content yet. Switch to Edit mode to write.</p>' }}
          />
        )}

        {mode === 'edit' && (
          <div className="p-3 flex flex-col gap-2 h-full">
            <textarea
              className="flex-1 w-full text-sm font-mono bg-surface-50 border border-surface-200 rounded p-2 text-ink resize-none focus:outline-none focus:border-accent/50 leading-relaxed min-h-[300px]"
              value={body}
              onChange={e => { setBody(e.target.value); setIsDirty(true) }}
              placeholder={`# ${entity.name}\n\n## Appearance\n\n## Personality\n\n## Notes\n\n[[OtherEntity]]`}
              spellCheck
            />
            <p className="text-[10px] text-ink-faint">Supports Markdown. Use [[EntityName]] to link to other entities.</p>
          </div>
        )}

        {mode === 'meta' && (
          <div className="p-3 space-y-4">
            {/* Structured metadata */}
            <div>
              <label className="text-xs font-semibold text-ink-faint uppercase tracking-wider">Name</label>
              <input className="input mt-1 text-sm" value={metaForm.name} onChange={e => setMetaForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-faint uppercase tracking-wider">Summary</label>
              <textarea className="input mt-1 text-sm resize-none" rows={3} value={metaForm.summary} onChange={e => setMetaForm(f => ({ ...f, summary: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-faint uppercase tracking-wider">Aliases</label>
              <input className="input mt-1 text-xs" placeholder="Alias1, Alias2..." value={metaForm.aliases} onChange={e => setMetaForm(f => ({ ...f, aliases: e.target.value }))} />
            </div>

            {/* Frontmatter extra fields */}
            {Object.entries(frontmeta).filter(([k]) => !['type', 'aliases', 'tags'].includes(k)).length > 0 && (
              <div>
                <label className="text-xs font-semibold text-ink-faint uppercase tracking-wider">Custom Fields</label>
                <div className="mt-1 space-y-1">
                  {Object.entries(frontmeta).filter(([k]) => !['type', 'aliases', 'tags'].includes(k)).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs">
                      <span className="text-ink-muted font-medium w-24 shrink-0">{k}:</span>
                      <span className="text-ink">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Relationships */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-ink-faint uppercase tracking-wider">Relationships</label>
                <button className="text-xs text-accent hover:underline flex items-center gap-1" onClick={() => setShowRelationForm(true)}>
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <div className="space-y-1">
                {relations.map(rel => {
                  const other = rel.from_entity_id === entity.id ? rel.to_entity : rel.from_entity
                  const direction = rel.from_entity_id === entity.id ? '→' : '←'
                  return (
                    <div key={rel.id} className="flex items-center gap-2 text-xs group">
                      <span className="text-ink-faint">{direction}</span>
                      <span className="bg-surface-100 px-1.5 py-0.5 rounded text-ink-muted">{rel.relation_type}</span>
                      <button className="text-ink flex-1 text-left hover:text-accent truncate" onClick={() => setActiveEntity(other.id)}>{other.name}</button>
                      <button className="hidden group-hover:block text-red-400 hover:text-red-600" onClick={() => deleteRelation(rel.id)}><Trash2 className="w-3 h-3" /></button>
                    </div>
                  )
                })}
                {relations.length === 0 && <p className="text-xs text-ink-faint">No relationships yet</p>}
              </div>
            </div>

            {/* Mentions */}
            <div>
              <label className="text-xs font-semibold text-ink-faint uppercase tracking-wider">Appears In ({mentions.length})</label>
              <div className="mt-1 space-y-1">
                {mentions.map(m => (
                  <div key={m.document_id} className="flex items-center gap-2 text-xs text-ink-muted">
                    <span className="flex-1 truncate">{m.document_title}</span>
                    <span className="text-ink-faint">{m.mention_count}×</span>
                  </div>
                ))}
                {mentions.length === 0 && <p className="text-xs text-ink-faint">Not mentioned yet</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      {showRelationForm && (
        <RelationForm
          entityId={entity.id}
          onSave={async (data) => {
            await window.api.relation.create(data as Record<string, unknown>)
            await loadData()
            setShowRelationForm(false)
          }}
          onClose={() => setShowRelationForm(false)}
        />
      )}
    </div>
  )
}
