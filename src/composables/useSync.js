import { ref, computed } from 'vue'
import { db } from '../db'
import { 
  isSupabaseConfigured,
  syncPointagesToSupabase,
  getPointagesFromSupabase,
  syncSettingsToSupabase,
  getSettingsFromSupabase
} from '../db/supabase'
import { useToast } from './useToast'

const { success: showSuccess, error: showError } = useToast()

const isSyncing = ref(false)
const lastSyncDate = ref(null)
const syncError = ref(null)

export function useSync() {
  const isConfigured = computed(() => isSupabaseConfigured())

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
      const pointages = await db.pointages.toArray()
      const pointagesResult = await syncPointagesToSupabase(pointages)
      
      if (!pointagesResult.success) {
        throw new Error(pointagesResult.error)
      }

      // Sync settings
      const settings = await db.settings.toArray()
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
        // Fusionner avec les données locales (éviter les doublons)
        for (const pointage of pointagesResult.data) {
          const existing = await db.pointages.get(pointage.id)
          if (!existing) {
            await db.pointages.add({
              id: pointage.id,
              timestamp: pointage.timestamp,
              date: pointage.date
            })
          }
        }
      }

      // Récupérer les settings
      const settingsResult = await getSettingsFromSupabase()
      if (settingsResult.success && settingsResult.data) {
        for (const setting of settingsResult.data) {
          await db.settings.put({
            key: setting.key,
            value: setting.value
          })
        }
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
