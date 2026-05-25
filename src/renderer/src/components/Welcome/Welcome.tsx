import React, { useState } from 'react'
import { BookOpen, FolderOpen, Plus } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'

export function Welcome(): React.ReactElement {
  const [creating, setCreating] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [error, setError] = useState('')
  const { loadProject } = useProjectStore()

  const handleCreate = async (): Promise<void> => {
    if (!projectName.trim()) { setError('Please enter a project name'); return }
    setError('')
    const result = await window.api.project.createDialog(projectName.trim())
    if (result.canceled) return
    if (result.success) {
      await loadProject(result.projectPath, result.config)
    } else {
      setError(result.error || 'Failed to create project')
    }
  }

  const handleOpen = async (): Promise<void> => {
    const result = await window.api.project.openDialog()
    if (result.canceled) return
    if (result.success) {
      await loadProject(result.projectPath, result.config)
    } else {
      setError(result.error || 'Failed to open project')
    }
  }

  return (
    <div className="h-full flex items-center justify-center bg-surface-50">
      <div className="w-full max-w-md px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent/10 rounded-2xl mb-4">
            <BookOpen className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl font-bold text-ink mb-2">Scriptorium</h1>
          <p className="text-ink-muted text-sm">Your writing. Your files. Your story.</p>
        </div>

        {creating ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Project Name</label>
              <input
                className="input"
                placeholder="My Novel"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={handleCreate}>
                Choose Location & Create
              </button>
              <button className="btn-ghost" onClick={() => { setCreating(false); setError(''); setProjectName('') }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-accent text-white rounded-xl hover:bg-accent-dark transition-colors"
              onClick={() => setCreating(true)}
            >
              <Plus className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">New Project</div>
                <div className="text-xs opacity-75">Start a new writing project</div>
              </div>
            </button>
            <button
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-white border border-surface-200 text-ink rounded-xl hover:bg-surface-50 transition-colors"
              onClick={handleOpen}
            >
              <FolderOpen className="w-5 h-5 text-ink-muted" />
              <div className="text-left">
                <div className="font-medium">Open Project</div>
                <div className="text-xs text-ink-muted">Open an existing Scriptorium project</div>
              </div>
            </button>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
