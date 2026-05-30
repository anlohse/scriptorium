import React from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold, Italic, Strikethrough, List, ListOrdered, Quote,
  Heading1, Heading2, Heading3, Minus, Undo, Redo, ImagePlus,
  CopyCheck, ClipboardCopy, CheckCircle2, PenLine
} from 'lucide-react'
import type { Document } from '../../types'

interface Props {
  editor: Editor
  onInsertAssetImage: () => void
  activeDoc?: Document | null
  showDraft: boolean
  onSetMode: (showDraft: boolean) => void
  onSetCompleted: (completed: boolean) => void
  onCopyDraftToFinal: () => void
  onCopyFinalToDraft: () => void
}

export function EditorToolbar({
  editor,
  onInsertAssetImage,
  activeDoc,
  showDraft,
  onSetMode,
  onSetCompleted,
  onCopyDraftToFinal,
  onCopyFinalToDraft
}: Props): React.ReactElement {
  const ToolBtn = ({ onClick, active, title, children }: {
    onClick: () => void; active?: boolean; title: string; children: React.ReactNode
  }): React.ReactElement => (
    <button
      className={`p-1.5 rounded transition-colors ${active ? 'bg-surface-200 text-ink' : 'text-ink-muted hover:bg-surface-100 hover:text-ink'}`}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  )

  const Sep = (): React.ReactElement => <div className="w-px h-5 bg-surface-200 mx-1" />

  const isDraftable = activeDoc && (activeDoc.type === 'chapter' || activeDoc.type === 'scene') && activeDoc.draft_path
  const completed = Boolean(activeDoc?.completed)

  return (
    <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-surface-100 bg-surface-50 shrink-0 flex-wrap">
      <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)">
        <Undo className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Y)">
        <Redo className="w-3.5 h-3.5" />
      </ToolBtn>
      <Sep />
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
        <Heading1 className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
        <Heading2 className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
        <Heading3 className="w-3.5 h-3.5" />
      </ToolBtn>
      <Sep />
      <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)">
        <Bold className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)">
        <Italic className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
        <Strikethrough className="w-3.5 h-3.5" />
      </ToolBtn>
      <Sep />
      <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
        <List className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">
        <ListOrdered className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
        <Quote className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">
        <Minus className="w-3.5 h-3.5" />
      </ToolBtn>
      <Sep />
      <ToolBtn onClick={onInsertAssetImage} title="Insert image from assets">
        <ImagePlus className="w-3.5 h-3.5" />
      </ToolBtn>

      {isDraftable && (
        <>
          <Sep />
          {/* Draft / Final toggle */}
          <div className="flex rounded border border-surface-200 overflow-hidden text-xs">
            <button
              className={`px-2 py-1 flex items-center gap-1 transition-colors ${showDraft ? 'bg-amber-100 text-amber-800 font-medium' : 'text-ink-muted hover:bg-surface-100'}`}
              onClick={() => onSetMode(true)}
              title="Edit draft"
              type="button"
            >
              <PenLine className="w-3 h-3" />
              Draft
            </button>
            <button
              className={`px-2 py-1 flex items-center gap-1 transition-colors border-l border-surface-200 ${!showDraft ? 'bg-green-100 text-green-800 font-medium' : 'text-ink-muted hover:bg-surface-100'}`}
              onClick={() => onSetMode(false)}
              title="Edit final"
              type="button"
            >
              <CheckCircle2 className="w-3 h-3" />
              Final
            </button>
          </div>

          {/* Completed toggle */}
          <label className="flex items-center gap-1.5 ml-1 text-xs cursor-pointer text-ink-muted hover:text-ink" title="Mark as completed">
            <input
              type="checkbox"
              className="rounded w-3 h-3"
              checked={completed}
              onChange={e => onSetCompleted(e.target.checked)}
            />
            Completed
          </label>

          <Sep />

          {/* Copy actions */}
          <ToolBtn onClick={onCopyDraftToFinal} title="Copy Draft → Final">
            <CopyCheck className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn onClick={onCopyFinalToDraft} title="Copy Final → Draft">
            <ClipboardCopy className="w-3.5 h-3.5" />
          </ToolBtn>
        </>
      )}
    </div>
  )
}
