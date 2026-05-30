import { ipcMain } from 'electron'
import {
  createEntity, getEntity, updateEntity, deleteEntity, listEntities, searchEntitiesByName,
  createRelation, deleteRelation, getEntityRelations,
  countEntityChildren, isEntityDescendant, reorderEntities,
  Entity
} from '../db/entities'
import { getMentionsByEntity } from '../db/mentions'
import { getCurrentProjectPath } from './project'
import { getEntityBodyPath, deleteEntityBody } from '../fs'
import { existsSync } from 'fs'

export function registerEntityHandlers(): void {
  ipcMain.handle('entity:list', (_event, type?: string) => {
    return listEntities(type)
  })

  ipcMain.handle('entity:get', (_event, id: string) => {
    return getEntity(id)
  })

  ipcMain.handle('entity:create', (_event, data: Omit<Entity, 'id' | 'created_at' | 'updated_at'>) => {
    return createEntity(data)
  })

  ipcMain.handle('entity:update', (_event, id: string, data: Partial<Omit<Entity, 'id' | 'created_at'>>) => {
    return updateEntity(id, data)
  })

  ipcMain.handle('entity:delete', (_event, id: string) => {
    const entity = getEntity(id)
    if (!entity) return { success: false, error: 'Entity not found' }

    if (entity.is_folder) {
      const childCount = countEntityChildren(id)
      if (childCount > 0) {
        return { success: false, error: 'Folder is not empty. Move or delete its contents first.' }
      }
    }

    const projectPath = getCurrentProjectPath()
    if (projectPath) {
      const bodyPath = getEntityBodyPath(projectPath, id)
      if (existsSync(bodyPath)) deleteEntityBody(projectPath, id)
    }

    deleteEntity(id)
    return { success: true }
  })

  ipcMain.handle('entity:search', (_event, query: string) => {
    return searchEntitiesByName(query)
  })

  ipcMain.handle('entity:getMentions', (_event, entityId: string) => {
    return getMentionsByEntity(entityId)
  })

  ipcMain.handle('entity:getRelations', (_event, entityId: string) => {
    return getEntityRelations(entityId)
  })

  ipcMain.handle('entity:reorder', (_event, updates: Array<{ id: string; sort_order: number }>) => {
    reorderEntities(updates)
    return { success: true }
  })

  ipcMain.handle('entity:move', (_event, id: string, newParentId: string | null) => {
    const entity = getEntity(id)
    if (!entity) return { success: false, error: 'Entity not found' }

    if (newParentId) {
      const newParent = getEntity(newParentId)
      if (!newParent || !newParent.is_folder) return { success: false, error: 'Target is not a folder' }
      if (newParent.type !== entity.type) return { success: false, error: 'Cannot move across entity types' }
      if (newParentId === id) return { success: false, error: 'Cannot move a folder into itself' }
      if (entity.is_folder && isEntityDescendant(id, newParentId)) {
        return { success: false, error: 'Cannot move a folder into its own subfolder' }
      }
    }

    const siblings = listEntities(entity.type).filter(e => (e.parent_id ?? null) === newParentId && e.id !== id)
    const sort_order = siblings.length

    updateEntity(id, { parent_id: newParentId, sort_order })
    return { success: true }
  })

  ipcMain.handle('relation:create', (_event, data: { from_entity_id: string; to_entity_id: string; relation_type: string }) => {
    return createRelation(data)
  })

  ipcMain.handle('relation:delete', (_event, id: string) => {
    deleteRelation(id)
    return { success: true }
  })
}
