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
import { EditorToolbar } from './EditorToolbar'
import { EmptyState } from './EmptyState'
import { ImagePickerDialog } from './ImagePickerDialog'

const AUTOSAVE_DELAY = 2000

// Extend Image to support width and height attributes
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
  const { documents, assets } = useProjectStore()
  const { setContent, markDirty, markClean, setSaving, setWordCount, setLastSaved, reset } = useEditorStore()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentDocId = useRef<string | null>(null)
  const isLoading = useRef(false)
  const [showImagePicker, setShowImagePicker] = useState(false)

  const activeDoc = documents.find(d => d.id === activeDocumentId)

  const save = useCallback(async (docId: string, html: string, text: string): Promise<void> => {
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
      })
    ],
    content: '',
    editable: false,
    onUpdate: ({ editor }) => {
      if (isLoading.current) return
      const html = editor.getHTML()
      const text = editor.getText()
      setContent(html)
      markDirty()
      const words = text.trim() ? text.trim().split(/\s+/).length : 0
      setWordCount(words)

      if (currentDocId.current) {
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => {
          save(currentDocId.current!, html, text)
        }, AUTOSAVE_DELAY)
      }
    }
  })

  // Load document when selection changes
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

      const content = await window.api.doc.getContent(activeDocumentId)
      currentDocId.current = activeDocumentId

      editor.commands.setContent(content || '')
      editor.setEditable(true)
      isLoading.current = false

      const text = editor.getText()
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0)
    }

    loadDoc()
  }, [activeDocumentId, editor])

  // Drop images + mention click navigation
  useEffect(() => {
    if (!editor) return
    const el = editor.view.dom

    const handleDrop = (e: DragEvent): void => {
      e.preventDefault()
      const files = e.dataTransfer?.files
      if (!files) return
      Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file)
          editor.chain().focus().setImage({ src: url }).run()
        }
      })
    }

    const handleClick = (e: MouseEvent): void => {
      const target = e.target as HTMLElement
      const mention = target.closest('.mention') as HTMLElement | null
      if (mention) {
        const entityId = mention.getAttribute('data-id')
        if (entityId) {
          useUIStore.getState().setActiveEntity(entityId)
          useUIStore.getState().setInspectorOpen(true)
        }
      }
    }

    el.addEventListener('drop', handleDrop)
    el.addEventListener('click', handleClick)
    return () => {
      el.removeEventListener('drop', handleDrop)
      el.removeEventListener('click', handleClick)
    }
  }, [editor])

  const handleInsertAssetImage = (src: string, width: number | null, height: number | null, alt: string): void => {
    if (!editor) return
    editor.chain().focus().setImage({
      src,
      alt,
      ...(width ? { width: String(width) } : {}),
      ...(height ? { height: String(height) } : {})
    }).run()
    setShowImagePicker(false)
  }

  if (!activeDocumentId) {
    return <EmptyState />
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {editor && (
        <EditorToolbar
          editor={editor}
          onInsertAssetImage={() => setShowImagePicker(true)}
        />
      )}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[70ch] mx-auto px-8 py-12">
          {activeDoc && (
            <h1 className="text-2xl font-bold text-ink mb-6 font-serif" contentEditable={false}>
              {activeDoc.title}
            </h1>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>

      {showImagePicker && (
        <ImagePickerDialog
          assets={assets}
          onInsert={handleInsertAssetImage}
          onClose={() => setShowImagePicker(false)}
        />
      )}
    </div>
  )
}
