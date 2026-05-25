import React from 'react'
import type { Editor } from '@tiptap/react'
import { Bold, Italic, Strikethrough, List, ListOrdered, Quote, Heading1, Heading2, Heading3, Minus, Undo, Redo, ImagePlus } from 'lucide-react'

interface Props {
  editor: Editor
  onInsertAssetImage: () => void
}

export function EditorToolbar({ editor, onInsertAssetImage }: Props): React.ReactElement {
  const ToolBtn = ({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }): React.ReactElement => (
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
    </div>
  )
}
