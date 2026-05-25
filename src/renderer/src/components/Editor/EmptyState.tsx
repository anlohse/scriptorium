import React from 'react'
import { FileText, BookOpen, Users } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import { useUIStore } from '../../stores/uiStore'

export function EmptyState(): React.ReactElement {
  const { documents, volumes } = useProjectStore()
  const { setActiveSection } = useUIStore()

  const recentDocs = [...documents].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5)

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-surface-50 text-center p-8">
      <div className="max-w-sm">
        <div className="w-16 h-16 bg-surface-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-ink-muted" />
        </div>
        <h2 className="text-lg font-semibold text-ink mb-2">No document open</h2>
        <p className="text-sm text-ink-muted mb-6">Select a document from the sidebar to start writing, or create a new one.</p>

        <div className="flex gap-2 justify-center mb-6">
          <button className="btn-primary" onClick={() => {
            window.api.doc.create({ title: 'New Chapter', type: 'chapter' }).then(doc => {
              useProjectStore.getState().refreshDocuments()
              useUIStore.getState().setActiveDocument(doc.id)
            })
          }}>
            New Chapter
          </button>
          <button className="btn-ghost" onClick={() => setActiveSection('entities')}>
            <Users className="w-4 h-4" />
            Entities
          </button>
        </div>

        {recentDocs.length > 0 && (
          <div className="text-left">
            <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-2">Recent Documents</p>
            <div className="space-y-1">
              {recentDocs.map(doc => (
                <button
                  key={doc.id}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-100 transition-colors text-left"
                  onClick={() => useUIStore.getState().setActiveDocument(doc.id)}
                >
                  <BookOpen className="w-4 h-4 text-ink-muted shrink-0" />
                  <div>
                    <div className="text-sm text-ink">{doc.title}</div>
                    <div className="text-xs text-ink-muted capitalize">{doc.type} · {doc.word_count} words</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
