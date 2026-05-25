import { ipcMain } from 'electron'
import {
  createEntity, getEntity, updateEntity, deleteEntity, listEntities, searchEntitiesByName,
  createRelation, deleteRelation, getEntityRelations,
  Entity
} from '../db/entities'
import { getMentionsByEntity } from '../db/mentions'

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

  ipcMain.handle('relation:create', (_event, data: { from_entity_id: string; to_entity_id: string; relation_type: string }) => {
    return createRelation(data)
  })

  ipcMain.handle('relation:delete', (_event, id: string) => {
    deleteRelation(id)
    return { success: true }
  })
}
