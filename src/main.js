import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'
import { db } from './db'
import { 
  isSupabaseConfigured, 
  getPointagesFromSupabase, 
  getSettingsFromSupabase, 
  subscribeToChanges 
} from './db/supabase'
import { useToast } from './composables/useToast'
import { CUSTOM_EVENTS, TOAST_DURATION } from './utils/constants'
import { dispatchCustomEvent } from './utils/dbHelpers'
import { syncLogger, realtimeLogger } from './utils/logger'

const { error: showError, warning: showWarning } = useToast()

/**
 * Synchronisation initiale des pointages depuis le cloud
 */
async function syncInitialPointages() {
  try {
    const result = await getPointagesFromSupabase()
    
    if (!result.success) {
      syncLogger.error('Échec sync initiale pointages:', result.error)
      showError('Échec de récupération des données cloud. Seules les données locales sont disponibles.', TOAST_DURATION.CRITICAL_ERROR)
      return
    }

    if (!result.data) return

    syncLogger.info(`Sync initiale: ${result.data.length} pointages du cloud`)

    const cloudIds = result.data.map(p => p.id)
    const localPointages = await db.pointages.toArray()
    
    // Supprimer les pointages locaux orphelins
    for (const localPointage of localPointages) {
      if (!cloudIds.includes(localPointage.id)) {
        syncLogger.delete('Suppression locale du pointage orphelin:', localPointage.id)
        await db.pointages.delete(localPointage.id)
      }
    }

    // Ajouter ou mettre à jour les pointages du cloud
    for (const pointage of result.data) {
      await db.pointages.put({
        id: pointage.id,
        timestamp: pointage.timestamp,
        date: pointage.date
      })
    }

    syncLogger.success('Synchronisation initiale terminée')
    dispatchCustomEvent(CUSTOM_EVENTS.POINTAGE_UPDATED)
  } catch (err) {
    syncLogger.error('Exception sync initiale pointages:', err)
    showError('Erreur de connexion au cloud. Mode hors ligne activé.', TOAST_DURATION.CRITICAL_ERROR)
  }
}

/**
 * Synchronisation initiale des paramètres depuis le cloud
 */
async function syncInitialSettings() {
  try {
    const result = await getSettingsFromSupabase()
    
    if (!result.success) {
      syncLogger.error('Échec sync initiale settings:', result.error)
      showWarning('Impossible de récupérer les paramètres cloud', TOAST_DURATION.WARNING)
      return
    }

    if (!result.data) return

    for (const setting of result.data) {
      await db.settings.put({
        key: setting.key,
        value: setting.value
      })
    }
    
    dispatchCustomEvent(CUSTOM_EVENTS.SETTING_UPDATED)
    syncLogger.success('Paramètres synchronisés')
  } catch (err) {
    syncLogger.error('Exception sync initiale settings:', err)
    showWarning('Erreur de connexion pour les paramètres', TOAST_DURATION.WARNING)
  }
}

/**
 * Gère les changements en temps réel des pointages
 */
async function handlePointageChange(payload) {
  realtimeLogger.sync('Changement pointage:', payload.eventType)
  
  try {
    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
      const pointage = payload.new
      realtimeLogger.info('Mise à jour/ajout pointage:', pointage.id)
      
      await db.pointages.put({
        id: pointage.id,
        timestamp: pointage.timestamp,
        date: pointage.date
      })
      
      dispatchCustomEvent(CUSTOM_EVENTS.POINTAGE_UPDATED)
      realtimeLogger.success('Pointage mis à jour localement')
    } 
    else if (payload.eventType === 'DELETE') {
      const deletedId = payload.old?.id
      
      if (!deletedId) {
        realtimeLogger.error('ID de suppression manquant:', payload)
        return
      }
      
      realtimeLogger.delete('Suppression pointage:', deletedId)
      await db.pointages.delete(deletedId)
      
      dispatchCustomEvent(CUSTOM_EVENTS.POINTAGE_UPDATED)
      realtimeLogger.success('Suppression locale terminée')
    }
  } catch (error) {
    realtimeLogger.error('Erreur callback pointage:', error)
    showError('Erreur de synchronisation temps réel', TOAST_DURATION.ERROR)
  }
}

/**
 * Gère les changements en temps réel des paramètres
 */
async function handleSettingChange(payload) {
  realtimeLogger.sync('Changement setting:', payload.eventType)
  
  try {
    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
      const setting = payload.new
      await db.settings.put({
        key: setting.key,
        value: setting.value
      })
      dispatchCustomEvent(CUSTOM_EVENTS.SETTING_UPDATED)
    } 
    else if (payload.eventType === 'DELETE') {
      await db.settings.delete(payload.old.key)
      dispatchCustomEvent(CUSTOM_EVENTS.SETTING_UPDATED)
    }
  } catch (error) {
    realtimeLogger.error('Erreur callback settings:', error)
    showError('Erreur de synchronisation paramètres', TOAST_DURATION.ERROR)
  }
}

// Initialisation
if (isSupabaseConfigured()) {
  syncInitialPointages()
  syncInitialSettings()
  
  realtimeLogger.info('Abonnement aux changements real-time Supabase')
  subscribeToChanges(handlePointageChange, handleSettingChange)
}

const app = createApp(App)
app.use(router)
app.mount('#app')
