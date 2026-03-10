import Dexie from 'dexie'
import { syncPointagesToSupabase, syncSettingsToSupabase, deletePointageFromSupabase, isSupabaseConfigured } from './supabase'
import { useToast } from '../composables/useToast'
import { executeWithRollback, dispatchCustomEvent } from '../utils/dbHelpers'
import { CUSTOM_EVENTS, TOAST_DURATION } from '../utils/constants'
import { dbLogger } from '../utils/logger'

const { error: showError } = useToast()

export const db = new Dexie('PointageDB')

db.version(1).stores({
  pointages: '++id, timestamp, date',
  settings: 'key'
})

/**
 * Récupère un paramètre
 */
export async function getSetting(key, defaultValue = null) {
  const row = await db.settings.get(key)
  return row ? row.value : defaultValue
}

/**
 * Enregistre un paramètre avec synchronisation
 */
export async function setSetting(key, value) {
  const originalSetting = await db.settings.get(key)
  const settingData = { key, value }
  
  return executeWithRollback({
    operation: async () => {
      await db.settings.put(settingData)
      return settingData
    },
    rollback: async () => {
      if (originalSetting) {
        await db.settings.put(originalSetting)
      } else {
        await db.settings.delete(key)
      }
    },
    syncOperation: isSupabaseConfigured() 
      ? async () => syncSettingsToSupabase([settingData])
      : null,
    errorMessage: 'Échec de synchronisation du paramètre',
    eventName: CUSTOM_EVENTS.SETTING_UPDATED,
    shouldSync: isSupabaseConfigured()
  })
}

/**
 * Ajoute un pointage avec synchronisation automatique
 */
export async function addPointage(pointageData) {
  let addedId
  
  return executeWithRollback({
    operation: async () => {
      addedId = await db.pointages.add(pointageData)
      return addedId
    },
    rollback: async () => {
      if (addedId) {
        await db.pointages.delete(addedId)
      }
    },
    syncOperation: isSupabaseConfigured()
      ? async () => syncPointagesToSupabase([{ id: addedId, ...pointageData }])
      : null,
    errorMessage: 'Échec de synchronisation cloud. Le pointage n\'a pas été enregistré',
    eventName: CUSTOM_EVENTS.POINTAGE_UPDATED,
    shouldSync: isSupabaseConfigured()
  })
}

/**
 * Met à jour un pointage avec synchronisation automatique
 */
export async function updatePointage(id, updates) {
  const originalPointage = await db.pointages.get(id)
  
  if (!originalPointage) {
    showError('Pointage introuvable', TOAST_DURATION.ERROR)
    throw new Error('Pointage not found')
  }
  
  return executeWithRollback({
    operation: async () => {
      await db.pointages.update(id, updates)
      return await db.pointages.get(id)
    },
    rollback: async () => {
      await db.pointages.put(originalPointage)
    },
    syncOperation: isSupabaseConfigured()
      ? async () => {
          const pointage = await db.pointages.get(id)
          return syncPointagesToSupabase([pointage])
        }
      : null,
    errorMessage: 'Échec de synchronisation cloud. Modification annulée',
    eventName: CUSTOM_EVENTS.POINTAGE_UPDATED,
    shouldSync: isSupabaseConfigured()
  })
}

/**
 * Supprime un pointage avec synchronisation automatique
 */
export async function deletePointage(id) {
  const originalPointage = await db.pointages.get(id)
  
  if (!originalPointage) {
    showError('Pointage introuvable', TOAST_DURATION.ERROR)
    throw new Error('Pointage not found')
  }
  
  dbLogger.delete('Suppression pointage:', id)
  
  return executeWithRollback({
    operation: async () => {
      await db.pointages.delete(id)
      dbLogger.success('Pointage supprimé de IndexedDB')
    },
    rollback: async () => {
      await db.pointages.add(originalPointage)
    },
    syncOperation: isSupabaseConfigured()
      ? async () => {
          dbLogger.cloud('Envoi suppression à Supabase')
          const result = await deletePointageFromSupabase(id)
          if (result.success) {
            dbLogger.success('Suppression Supabase réussie')
          }
          return result
        }
      : null,
    errorMessage: 'Échec de synchronisation cloud. Suppression annulée',
    eventName: CUSTOM_EVENTS.POINTAGE_UPDATED,
    shouldSync: isSupabaseConfigured()
  })
}
