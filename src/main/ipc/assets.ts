import { ipcMain, dialog } from 'electron'
import { createAsset, updateAsset, deleteAsset, listAssets, Asset } from '../db/assets'
import { getCurrentProjectPath } from './project'
import { copyAssetToProject } from '../fs'

export function registerAssetHandlers(): void {
  ipcMain.handle('asset:list', (_event, filters?: { type?: string; entity_id?: string }) => {
    return listAssets(filters)
  })

  ipcMain.handle('asset:import', async (_event, assetType: string) => {
    const result = await dialog.showOpenDialog({
      title: 'Import Asset',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] }]
    })
    if (result.canceled || !result.filePaths[0]) return { canceled: true }

    const projectPath = getCurrentProjectPath()
    if (!projectPath) return { success: false, error: 'No project open' }

    const sourcePath = result.filePaths[0]
    const destPath = copyAssetToProject(projectPath, sourcePath, assetType)
    return { success: true, path: destPath }
  })

  ipcMain.handle('asset:create', (_event, data: Omit<Asset, 'id' | 'created_at' | 'updated_at'>) => {
    return createAsset(data)
  })

  ipcMain.handle('asset:update', (_event, id: string, data: Partial<Asset>) => {
    return updateAsset(id, data)
  })

  ipcMain.handle('asset:delete', (_event, id: string) => {
    deleteAsset(id)
    return { success: true }
  })
}
