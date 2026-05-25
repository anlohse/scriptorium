import React, { useEffect, useState } from 'react'
import { FileText, Calendar } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import type { Document } from '../../types'

interface Props {
  document: Document
}

export function DocumentInspector({ document }: Props): React.ReactElement {
  const { volumes, upsertDocument } = useProjectStore()
  const [editTitle, setEditTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(document.title)

  const volume = document.volume_id ? volumes.find(v => v.id === document.volume_id) : null

  useEffect(() => {
    setTitleValue(document.title)
  }, [document.id, document.title])

  const saveTitle = async (): Promise<void> => {
    if (titleValue.trim() && titleValue !== document.title) {
      const updated = await window.api.doc.update(document.id, { title: titleValue.trim() })
      if (updated) upsertDocument(updated)
    }
    setEditTitle(false)
  }

  const fmt = (d: string): string => new Date(d).toLocaleDateString()

  return (
    <div className="p-4 space-y-5">
      {/* Title */}
      <div>
        <label className="text-xs font-semibold text-ink-faint uppercase tracking-wider block mb-1">Title</label>
        {editTitle ? (
          <input
            className="input text-sm"
            value={titleValue}
            onChange={e => setTitleValue(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setEditTitle(false); setTitleValue(document.title) } }}
            autoFocus
          />
        ) : (
          <p className="text-sm text-ink cursor-pointer hover:text-accent" onClick={() => setEditTitle(true)}>
            {document.title}
          </p>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <FileText className="w-3.5 h-3.5" />
          <span className="capitalize">{document.type}</span>
          {volume && <span className="text-ink-faint">· {volume.title}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <span>{document.word_count.toLocaleString()} words</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <Calendar className="w-3.5 h-3.5" />
          <span>Created {fmt(document.created_at)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <Calendar className="w-3.5 h-3.5" />
          <span>Updated {fmt(document.updated_at)}</span>
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs font-semibold text-ink-faint uppercase tracking-wider block mb-1">Tags</label>
        <TagEditor
          tags={document.tags}
          onChange={async (tags) => {
            const updated = await window.api.doc.update(document.id, { tags })
            if (updated) upsertDocument(updated)
          }}
        />
      </div>
    </div>
  )
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }): React.ReactElement {
  const [input, setInput] = useState('')
  const [localTags, setLocalTags] = useState(tags)

  useEffect(() => setLocalTags(tags), [tags])

  const addTag = (): void => {
    if (!input.trim()) return
    const tag = input.trim().toLowerCase()
    if (localTags.includes(tag)) return
    const next = [...localTags, tag]
    setLocalTags(next)
    onChange(next)
    setInput('')
  }

  const removeTag = (tag: string): void => {
    const next = localTags.filter(t => t !== tag)
    setLocalTags(next)
    onChange(next)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {localTags.map(tag => (
          <span key={tag} className="flex items-center gap-1 text-xs bg-surface-200 text-ink-muted px-2 py-0.5 rounded-full">
            {tag}
            <button className="hover:text-red-500 leading-none" onClick={() => removeTag(tag)}>×</button>
          </span>
        ))}
        {localTags.length === 0 && <span className="text-xs text-ink-faint">No tags</span>}
      </div>
      <input
        className="input text-xs py-1"
        placeholder="Add tag (press Enter)..."
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
      />
    </div>
  )
}
