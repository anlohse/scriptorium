import React, { useEffect } from 'react'
import { useProjectStore } from './stores/projectStore'
import { Welcome } from './components/Welcome/Welcome'
import { AppLayout } from './components/Layout/AppLayout'

export default function App(): React.ReactElement {
  const { projectPath, loadProject } = useProjectStore()

  useEffect(() => {
    // Restore previously opened project
    window.api.project.getCurrent().then((result) => {
      if (result?.projectPath && result?.config) {
        loadProject(result.projectPath, result.config)
      }
    })
  }, [])

  if (!projectPath) {
    return <Welcome />
  }

  return <AppLayout />
}
