import { ref, computed } from 'vue'
import {
  getAllPointagesFromCache,
  getAllSettingsFromCache,
  upsertPointageInCache,
  upsertSettingInCache,
  notifyPointagesChanged
} from '../db'
import { 
  isSupabaseConfigured,
  supabaseConfiguredRef,
  syncPointagesToSupabase,
  getPointagesFromSupabase,
  syncSettingsToSupabase,
  getSettingsFromSupabase
} from '../db/supabase'
import { useToast } from './useToast'
import { TOAST_DURATION } from '../utils/constants'
import { syncLogger } from '../utils/logger'
import { dispatchCustomEvent } from '../utils/dbHelpers'
import { CUSTOM_EVENTS } from '../utils/constants'

const { success: showSuccess, error: showError } = useToast()

const isSyncing = ref(false)
const lastSyncDate = ref(null)
const syncError = ref(null)

export function useSync() {
  const isConfigured = computed(() => supabaseConfiguredRef.value && isSupabaseConfigured())

  // Synchroniser tous les pointages locaux vers Supabase
  async function syncToCloud() {
    if (!isSupabaseConfigured()) {
      syncLogger.info('Sync désactivé : Supabase non configuré')
      return { success: false, error: 'Non configuré' }
    }

    isSyncing.value = true
    syncError.value = null

    try {
      // Sync pointages
      const pointages = await getAllPointagesFromCache()
      const pointagesResult = await syncPointagesToSupabase(pointages)
      
      if (!pointagesResult.success) {
        throw new Error(pointagesResult.error)
      }

      // Sync settings
      const settings = await getAllSettingsFromCache({ excludeLocalOnly: true })
      const settingsResult = await syncSettingsToSupabase(settings)
      
      if (!settingsResult.success) {
        throw new Error(settingsResult.error)
      }

      lastSyncDate.value = new Date()
      showSuccess('Données synchronisées vers le cloud', TOAST_DURATION.SUCCESS)
      return { success: true }
    } catch (error) {
      syncError.value = error.message
      console.error('Erreur de synchronisation:', error)
      showError('Échec de synchronisation vers le cloud', TOAST_DURATION.ERROR)
      return { success: false, error: error.message }
    } finally {
      isSyncing.value = false
    }
  }

  // Récupérer les données depuis Supabase et les fusionner avec le local
  async function syncFromCloud() {
    if (!isSupabaseConfigured()) {
      syncLogger.info('Sync désactivé : Supabase non configuré')
      return { success: false, error: 'Non configuré' }
    }

    isSyncing.value = true
    syncError.value = null

    try {
      // Récupérer les pointages
      const pointagesResult = await getPointagesFromSupabase()
      if (pointagesResult.success && pointagesResult.data) {
        // Fusionner avec les données locales
        for (const pointage of pointagesResult.data) {
          await upsertPointageInCache({
            id: pointage.id,
            timestamp: pointage.timestamp,
            date: pointage.date
          })
        }
        notifyPointagesChanged()
        dispatchCustomEvent(CUSTOM_EVENTS.POINTAGE_UPDATED)
      }

      // Récupérer les settings
      const settingsResult = await getSettingsFromSupabase()
      if (settingsResult.success && settingsResult.data) {
        for (const setting of settingsResult.data) {
          await upsertSettingInCache({
            key: setting.key,
            value: setting.value
          })
        }
        dispatchCustomEvent(CUSTOM_EVENTS.SETTING_UPDATED)
      }

      lastSyncDate.value = new Date()
      showSuccess('Données récupérées depuis le cloud', TOAST_DURATION.SUCCESS)
      return { success: true }
    } catch (error) {
      syncError.value = error.message
      console.error('Erreur de synchronisation:', error)
      showError('Échec de récupération depuis le cloud', TOAST_DURATION.ERROR)
      return { success: false, error: error.message }
    } finally {
      isSyncing.value = false
    }
  }

  // Synchronisation bidirectionnelle
  async function fullSync() {
    const fromResult = await syncFromCloud()
    const toResult = await syncToCloud()
    
    if (fromResult.success && toResult.success) {
      showSuccess('Synchronisation bidirectionnelle réussie', TOAST_DURATION.SUCCESS)
    }
    
    return {
      success: fromResult.success && toResult.success,
      fromCloud: fromResult,
      toCloud: toResult
    }
  }

  return {
    isConfigured,
    isSyncing,
    lastSyncDate,
    syncError,
    syncToCloud,
    syncFromCloud,
    fullSync
  }
}
