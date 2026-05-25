import React, { useEffect, useRef, useCallback } from 'react'
import { useUIStore } from '../../stores/uiStore'
import { Sidebar } from '../Sidebar/Sidebar'
import { Editor } from '../Editor/Editor'
import { Inspector } from '../Inspector/Inspector'
import { SearchPanel } from '../Search/SearchPanel'
import { Titlebar } from './Titlebar'
import { TranslationEditor } from '../Editor/TranslationEditor'

const MIN_SIDEBAR = 180
const MAX_SIDEBAR = 520
const MIN_INSPECTOR = 220
const MAX_INSPECTOR = 600

export function AppLayout(): React.ReactElement {
  const { inspectorOpen, searchOpen, closeSearch, sidebarWidth, inspectorWidth, setSidebarWidth, setInspectorWidth, translationId } = useUIStore()
  const draggingRef = useRef<'sidebar' | 'inspector' | null>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        useUIStore.getState().openSearch()
      }
      if (e.key === 'Escape' && searchOpen) {
        closeSearch()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen])

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingRef.current) return
    const delta = e.clientX - startXRef.current
    if (draggingRef.current === 'sidebar') {
      const newW = Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, startWidthRef.current + delta))
      setSidebarWidth(newW)
    } else {
      const newW = Math.min(MAX_INSPECTOR, Math.max(MIN_INSPECTOR, startWidthRef.current - delta))
      setInspectorWidth(newW)
    }
  }, [setSidebarWidth, setInspectorWidth])

  const onMouseUp = useCallback(() => {
    draggingRef.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  const startDrag = (which: 'sidebar' | 'inspector', e: React.MouseEvent): void => {
    e.preventDefault()
    draggingRef.current = which
    startXRef.current = e.clientX
    startWidthRef.current = which === 'sidebar' ? sidebarWidth : inspectorWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div className="h-full flex flex-col bg-surface-50">
      <Titlebar />
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div style={{ width: sidebarWidth, minWidth: MIN_SIDEBAR, maxWidth: MAX_SIDEBAR }} className="flex-shrink-0 overflow-hidden">
          <Sidebar />
        </div>

        {/* Sidebar resize handle */}
        <div
          className="w-1 bg-surface-200 hover:bg-accent/40 cursor-col-resize flex-shrink-0 transition-colors active:bg-accent/60"
          onMouseDown={(e) => startDrag('sidebar', e)}
          onDoubleClick={() => setSidebarWidth(260)}
          title="Drag to resize · Double-click to reset"
        />

        {/* Main content area */}
        <main className="flex-1 flex overflow-hidden min-w-0">
          {translationId ? (
            <TranslationEditor translationId={translationId} />
          ) : (
            <Editor />
          )}

          {/* Inspector resize handle */}
          {inspectorOpen && (
            <div
              className="w-1 bg-surface-200 hover:bg-accent/40 cursor-col-resize flex-shrink-0 transition-colors active:bg-accent/60"
              onMouseDown={(e) => startDrag('inspector', e)}
              onDoubleClick={() => setInspectorWidth(320)}
              title="Drag to resize · Double-click to reset"
            />
          )}

          {/* Inspector */}
          {inspectorOpen && (
            <div style={{ width: inspectorWidth, minWidth: MIN_INSPECTOR, maxWidth: MAX_INSPECTOR }} className="flex-shrink-0 overflow-hidden">
              <Inspector />
            </div>
          )}
        </main>
      </div>
      {searchOpen && <SearchPanel />}
    </div>
  )
}
