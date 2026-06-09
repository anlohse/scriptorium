import React, { useEffect, useRef, useCallback, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Mention from '@tiptap/extension-mention'
import { useUIStore } from '../../stores/uiStore'
import { useProjectStore } from '../../stores/projectStore'
import { useEditorStore } from '../../stores/editorStore'
import { mentionSuggestion } from './mentionSuggestion'
import { PageBreak } from './PageBreakExtension'
import { SpellCheck } from './SpellCheckExtension'
import { SpellCheckMenu, type SpellMenuState } from './SpellCheckMenu'
import { EditorToolbar } from './EditorToolbar'
import { EmptyState } from './EmptyState'
import { ImagePickerDialog } from './ImagePickerDialog'

const AUTOSAVE_DELAY = 2000

const ExtendedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: el => el.getAttribute('width'),
        renderHTML: attrs => attrs.width ? { width: attrs.width } : {}
      },
      height: {
        default: null,
        parseHTML: el => el.getAttribute('height'),
        renderHTML: attrs => attrs.height ? { height: attrs.height } : {}
      }
    }
  }
})

export function Editor(): React.ReactElement {
  const { activeDocumentId } = useUIStore()
  const { documents, assets, refreshDocuments } = useProjectStore()
  const { setContent, markDirty, markClean, setSaving, setWordCount, setLastSaved, reset } = useEditorStore()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentDocId = useRef<string | null>(null)
  const isLoading = useRef(false)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [showDraft, setShowDraft] = useState(true)
  const [spellEnabled, setSpellEnabled] = useState(true)
  const [spellLocale, setSpellLocale] = useState('en-US')
  const [spellMenu, setSpellMenu] = useState<SpellMenuState | null>(null)

  const activeDoc = documents.find(d => d.id === activeDocumentId) ?? null
  const isDraftable = !!(activeDoc && (activeDoc.type === 'chapter' || activeDoc.type === 'scene') && activeDoc.draft_path)

  useEffect(() => {
    if (activeDoc) setShowDraft(Boolean(activeDoc.show_draft))
  }, [activeDoc?.id, activeDoc?.show_draft])

  const cancelPendingSave = (): void => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
  }

  const save = useCallback(async (docId: string, html: string): Promise<void> => {
    setSaving(true)
    try {
      await window.api.doc.save(docId, html)
      const mentionMatches = html.match(/data-id="([^"]+)"/g) || []
      const entityIds = [...new Set(mentionMatches.map(m => m.replace('data-id="', '').replace('"', '')))]
      await window.api.doc.syncMentions(docId, entityIds)
      markClean()
      setLastSaved(new Date())
    } finally {
      setSaving(false)
    }
  }, [markClean, setSaving, setLastSaved])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      ExtendedImage,
      Placeholder.configure({ placeholder: 'Begin your story...' }),
      CharacterCount,
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        suggestion: mentionSuggestion,
        renderHTML({ node }) {
          return ['span', { class: 'mention', 'data-id': node.attrs.id, 'data-label': node.attrs.label }, `[[${node.attrs.label}]]`]
        }
      }),
      PageBreak,
      SpellCheck
    ],
    content: '',
    editable: false,
    onUpdate: ({ editor }) => {
      if (isLoading.current) return
      const html = editor.getHTML()
      const text = editor.getText()
      setContent(html)
      markDirty()
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0)
      if (currentDocId.current) {
        cancelPendingSave()
        saveTimer.current = setTimeout(() => save(currentDocId.current!, html), AUTOSAVE_DELAY)
      }
    }
  })

  useEffect(() => {
    if (!editor) return
    if (!activeDocumentId) {
      editor.setEditable(false)
      editor.commands.setContent('')
      currentDocId.current = null
      reset()
      return
    }
    const loadDoc = async (): Promise<void> => {
      isLoading.current = true
      editor.setEditable(false)
      reset()
      cancelPendingSave()
      const content = await window.api.doc.getContent(activeDocumentId)
      currentDocId.current = activeDocumentId
      editor.commands.setContent(content || '')
      editor.setEditable(true)
      isLoading.current = false
      const text = editor.getText()
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0)
      editor.commands.triggerSpellCheck()
    }
    loadDoc()
  }, [activeDocumentId, editor])

  useEffect(() => {
    if (!editor) return
    const el = editor.view.dom
    const handleDrop = (e: DragEvent): void => {
      e.preventDefault()
      const files = e.dataTransfer?.files
      if (!files) return
      Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
          editor.chain().focus().setImage({ src: URL.createObjectURL(file) }).run()
        }
      })
    }
    const handleClick = (e: MouseEvent): void => {
      const mention = (e.target as HTMLElement).closest('.mention') as HTMLElement | null
      if (mention) {
        const entityId = mention.getAttribute('data-id')
        if (entityId) {
          useUIStore.getState().setActiveEntity(entityId)
          useUIStore.getState().setInspectorOpen(true)
        }
        return
      }
      const spellEl = (e.target as HTMLElement).closest('.spell-error') as HTMLElement | null
      if (spellEl) {
        const word = spellEl.getAttribute('data-spell-word') ?? ''
        const suggestions = JSON.parse(spellEl.getAttribute('data-spell-suggestions') ?? '[]') as string[]
        const from = parseInt(spellEl.getAttribute('data-spell-from') ?? '0', 10)
        const to = parseInt(spellEl.getAttribute('data-spell-to') ?? '0', 10)
        setSpellMenu({ word, suggestions, from, to, rect: spellEl.getBoundingClientRect() })
      }
    }
    el.addEventListener('drop', handleDrop)
    el.addEventListener('click', handleClick)
    return () => { el.removeEventListener('drop', handleDrop); el.removeEventListener('click', handleClick) }
  }, [editor])

  // ── Spell check settings sync ────────────────────────────────────────────

  useEffect(() => {
    if (!editor) return
    editor.commands.setSpellCheckEnabled(spellEnabled)
  }, [editor, spellEnabled])

  useEffect(() => {
    if (!editor) return
    editor.commands.setSpellCheckLocale(spellLocale)
  }, [editor, spellLocale])

  // ── Draft/Final handlers ──────────────────────────────────────────────────

  const handleSetMode = async (newShowDraft: boolean): Promise<void> => {
    if (!editor || !currentDocId.current || !isDraftable || newShowDraft === showDraft) return
    cancelPendingSave()
    setShowDraft(newShowDraft)
    editor.setEditable(false)
    const result = await window.api.doc.setMode(currentDocId.current, newShowDraft, editor.getHTML())
    if (result.success) {
      isLoading.current = true
      editor.commands.setContent(result.content || '')
      isLoading.current = false
      markClean()
    } else {
      setShowDraft(!newShowDraft)
    }
    editor.setEditable(true)
    await refreshDocuments()
  }

  const handleSetCompleted = async (completed: boolean): Promise<void> => {
    if (!editor || !currentDocId.current || !isDraftable) return
    cancelPendingSave()
    editor.setEditable(false)
    const result = await window.api.doc.setCompleted(currentDocId.current, completed, editor.getHTML())
    if (result.success) {
      isLoading.current = true
      editor.commands.setContent(result.content || '')
      isLoading.current = false
      markClean()
    }
    editor.setEditable(true)
    await refreshDocuments()
  }

  const handleCopyDraftToFinal = async (): Promise<void> => {
    if (!editor || !currentDocId.current || !isDraftable) return
    if (!confirm('Copy draft content to final? This will overwrite the final version.')) return
    cancelPendingSave()
    await window.api.doc.copyDraftToFinal(currentDocId.current, editor.getHTML())
    markClean()
  }

  const handleCopyFinalToDraft = async (): Promise<void> => {
    if (!editor || !currentDocId.current || !isDraftable) return
    if (!confirm('Copy final content to draft? This will overwrite the draft.')) return
    cancelPendingSave()
    await window.api.doc.copyFinalToDraft(currentDocId.current, editor.getHTML())
    markClean()
  }

  const handleSpellAccept = (suggestion: string, from: number, to: number): void => {
    if (!editor) return
    // Verify the word still occupies these positions before replacing
    try {
      const current = editor.state.doc.textBetween(from, to)
      if (current.toLowerCase() === spellMenu?.word.toLowerCase()) {
        editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, suggestion).run()
      }
    } catch { /* positions stale — skip */ }
  }

  const handleSpellIgnore = (word: string): void => {
    editor?.commands.ignoreSpellWord(word)
  }

  const handleSpellAddToDict = (word: string): void => {
    editor?.commands.addSpellWord(word)
  }

  const handleInsertAssetImage = (src: string, width: number | null, height: number | null, alt: string): void => {
    if (!editor) return
    editor.chain().focus().setImage({ src, alt, ...(width ? { width: String(width) } : {}), ...(height ? { height: String(height) } : {}) }).run()
    setShowImagePicker(false)
  }

  if (!activeDocumentId) return <EmptyState />

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {editor && (
        <EditorToolbar
          editor={editor}
          onInsertAssetImage={() => setShowImagePicker(true)}
          activeDoc={activeDoc}
          showDraft={showDraft}
          onSetMode={handleSetMode}
          onSetCompleted={handleSetCompleted}
          onCopyDraftToFinal={handleCopyDraftToFinal}
          onCopyFinalToDraft={handleCopyFinalToDraft}
          spellEnabled={spellEnabled}
          spellLocale={spellLocale}
          onToggleSpell={setSpellEnabled}
          onSetSpellLocale={setSpellLocale}
        />
      )}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[70ch] mx-auto px-8 py-12">
          {activeDoc && (
            <div className="mb-6 flex items-baseline gap-2">
              <h1 className="text-2xl font-bold text-ink font-serif flex-1" contentEditable={false}>
                {activeDoc.title}
              </h1>
              {isDraftable && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${showDraft ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                  {showDraft ? 'Draft' : 'Final'}
                </span>
              )}
            </div>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>
      {showImagePicker && (
        <ImagePickerDialog assets={assets} onInsert={handleInsertAssetImage} onClose={() => setShowImagePicker(false)} />
      )}
      {spellMenu && (
        <SpellCheckMenu
          state={spellMenu}
          onAccept={handleSpellAccept}
          onIgnore={handleSpellIgnore}
          onAddToDictionary={handleSpellAddToDict}
          onClose={() => setSpellMenu(null)}
        />
      )}
    </div>
  )
}
