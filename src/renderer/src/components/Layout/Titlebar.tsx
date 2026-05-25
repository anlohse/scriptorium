import React from 'react'
import { BookOpen, Search, PanelRight, FolderOpen, Download } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import { useUIStore } from '../../stores/uiStore'
import { useEditorStore } from '../../stores/editorStore'
import { ExportDialog } from '../Export/ExportDialog'

export function Titlebar(): React.ReactElement {
  const { config } = useProjectStore()
  const { toggleInspector, inspectorOpen, openSearch } = useUIStore()
  const { isDirty, wordCount, lastSaved } = useEditorStore()
  const [showExport, setShowExport] = React.useState(false)

  const handleOpen = async (): Promise<void> => {
    const result = await window.api.project.openDialog()
    if (result.success) {
      const { loadProject } = useProjectStore.getState()
      await loadProject(result.projectPath, result.config)
    }
  }

  return (
    <>
      <div className="h-11 bg-surface-100 border-b border-surface-200 flex items-center px-4 gap-3 shrink-0">
        <div className="flex items-center gap-2 text-ink-muted">
          <BookOpen className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm text-ink">{config?.projectName || 'Scriptorium'}</span>
          {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" title="Unsaved changes" />}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1 text-xs text-ink-faint">
          {wordCount > 0 && <span>{wordCount.toLocaleString()} words</span>}
          {lastSaved && <span className="ml-2">Saved {lastSaved.toLocaleTimeString()}</span>}
        </div>

        <div className="flex items-center gap-1">
          <button className="btn-ghost py-1 px-2" onClick={openSearch} title="Search (Ctrl+F)">
            <Search className="w-4 h-4" />
          </button>
          <button className="btn-ghost py-1 px-2" onClick={() => setShowExport(true)} title="Export">
            <Download className="w-4 h-4" />
          </button>
          <button className="btn-ghost py-1 px-2" onClick={handleOpen} title="Open Project">
            <FolderOpen className="w-4 h-4" />
          </button>
          <button
            className={`btn-ghost py-1 px-2 ${inspectorOpen ? 'bg-surface-200' : ''}`}
            onClick={toggleInspector}
            title="Toggle Inspector"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
    </>
  )
}
