import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { useProjectStore } from '../../stores/projectStore'
import { useUIStore } from '../../stores/uiStore'
import type { Translation, TranslationStatus } from '../../types'
import { X, Save, CheckCircle, Clock, AlertTriangle } from 'lucide-react'

const STATUS_CONFIG: Record<TranslationStatus, { label: string; icon: React.ReactNode; color: string }> = {
  untranslated: { label: 'Untranslated', icon: <X className="w-3 h-3" />, color: 'text-ink-faint' },
  draft: { label: 'Draft', icon: <Clock className="w-3 h-3" />, color: 'text-yellow-500' },
  in_progress: { label: 'In Progress', icon: <Clock className="w-3 h-3" />, color: 'text-blue-500' },
  completed: { label: 'Completed', icon: <CheckCircle className="w-3 h-3" />, color: 'text-green-500' },
  outdated: { label: 'Outdated', icon: <AlertTriangle className="w-3 h-3" />, color: 'text-orange-500' }
}

interface Props {
  translationId: string
}

export function TranslationEditor({ translationId }: Props): React.ReactElement {
  const { setTranslationId } = useUIStore()
  const { documents, upsertTranslation } = useProjectStore()
  const [translation, setTranslation] = useState<Translation | null>(null)
  const [originalContent, setOriginalContent] = useState('')
  const [translationContent, setTranslationContent] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leftScrollRef = useRef<HTMLDivElement>(null)
  const rightScrollRef = useRef<HTMLDivElement>(null)
  const isSyncingScroll = useRef(false)

  // Readonly editor for original document
  const originalEditor = useEditor({
    extensions: [StarterKit],
    editable: false,
    content: ''
  })

  useEffect(() => {
    loadData()
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [translationId])

  const loadData = async (): Promise<void> => {
    const t = await window.api.translation.get(translationId)
    if (!t) return
    setTranslation(t)

    // Load original document content
    const [origContent, transContent] = await Promise.all([
      window.api.doc.getContent(t.document_id),
      window.api.translation.getContent(translationId)
    ])
    setOriginalContent(origContent)
    setTranslationContent(transContent)
    if (originalEditor) originalEditor.commands.setContent(origContent || '')
  }

  useEffect(() => {
    if (originalEditor && originalContent) {
      originalEditor.commands.setContent(originalContent)
    }
  }, [originalContent, originalEditor])

  const document = translation ? documents.find(d => d.id === translation.document_id) : null

  const handleTranslationChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setTranslationContent(e.target.value)
    setIsDirty(true)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => autoSave(e.target.value), 2000)
  }

  const autoSave = async (content: string): Promise<void> => {
    if (!translation) return
    setIsSaving(true)
    await window.api.translation.saveContent(translation.id, content)
    setIsDirty(false)
    setIsSaving(false)
  }

  const save = async (): Promise<void> => {
    if (!translation) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setIsSaving(true)
    await window.api.translation.saveContent(translation.id, translationContent)
    setIsDirty(false)
    setIsSaving(false)
  }

  const setStatus = async (status: TranslationStatus): Promise<void> => {
    if (!translation) return
    const updated = await window.api.translation.updateStatus(translation.id, status)
    if (updated) {
      setTranslation(updated)
      upsertTranslation(updated)
    }
  }

  // Scroll sync
  const syncScroll = useCallback((source: 'left' | 'right') => {
    if (isSyncingScroll.current) return
    isSyncingScroll.current = true
    const src = source === 'left' ? leftScrollRef.current : rightScrollRef.current
    const dst = source === 'left' ? rightScrollRef.current : leftScrollRef.current
    if (src && dst) {
      const ratio = src.scrollTop / (src.scrollHeight - src.clientHeight || 1)
      dst.scrollTop = ratio * (dst.scrollHeight - dst.clientHeight)
    }
    requestAnimationFrame(() => { isSyncingScroll.current = false })
  }, [])

  if (!translation) return <div className="flex-1 flex items-center justify-center text-ink-faint">Loading…</div>

  const statusCfg = STATUS_CONFIG[translation.status]

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-surface-200 bg-white flex-shrink-0">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-ink truncate">{document?.title || 'Document'}</div>
          <div className="text-xs text-ink-muted">Translation · {translation.locale.toUpperCase()}</div>
        </div>

        {/* Status selector */}
        <select
          value={translation.status}
          onChange={e => setStatus(e.target.value as TranslationStatus)}
          className={`text-xs border border-surface-200 rounded px-2 py-1 bg-surface-50 ${statusCfg.color}`}
        >
          {(Object.keys(STATUS_CONFIG) as TranslationStatus[]).map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>

        {isDirty && (
          <button onClick={save} disabled={isSaving} className="flex items-center gap-1 text-xs bg-accent text-white px-2 py-1 rounded hover:bg-accent/80 disabled:opacity-50">
            <Save className="w-3 h-3" /> {isSaving ? 'Saving…' : 'Save'}
          </button>
        )}

        <button
          onClick={() => setTranslationId(null)}
          className="p-1 rounded hover:bg-surface-200 text-ink-muted"
          title="Close translation editor"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Split panes */}
      <div className="flex-1 flex overflow-hidden">
        {/* Original (left) */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-surface-200">
          <div className="px-3 py-1.5 border-b border-surface-100 bg-surface-100 flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">Original</span>
          </div>
          <div
            ref={leftScrollRef}
            className="flex-1 overflow-y-auto p-4"
            onScroll={() => syncScroll('left')}
          >
            <EditorContent editor={originalEditor} className="prose-editor prose-sm max-w-none" />
          </div>
        </div>

        {/* Translation (right) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 py-1.5 border-b border-surface-100 bg-surface-100 flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">Translation · {translation.locale.toUpperCase()}</span>
            <span className={`flex items-center gap-1 text-[10px] ml-auto ${statusCfg.color}`}>
              {statusCfg.icon} {statusCfg.label}
            </span>
          </div>
          <div
            ref={rightScrollRef}
            className="flex-1 overflow-y-auto p-4"
            onScroll={() => syncScroll('right')}
          >
            <textarea
              value={translationContent}
              onChange={handleTranslationChange}
              className="w-full h-full min-h-[400px] bg-transparent border-none outline-none text-sm text-ink leading-relaxed resize-none font-serif"
              placeholder="Write your translation here in Markdown…"
              spellCheck
            />
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="px-4 py-1 border-t border-surface-200 bg-surface-50 flex items-center gap-4 flex-shrink-0">
        <span className={`text-[10px] flex items-center gap-1 ${statusCfg.color}`}>{statusCfg.icon} {statusCfg.label}</span>
        {isSaving && <span className="text-[10px] text-ink-faint animate-pulse">Saving…</span>}
        {!isSaving && !isDirty && translation.updated_at && (
          <span className="text-[10px] text-ink-faint">Saved {new Date(translation.updated_at).toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  )
}
