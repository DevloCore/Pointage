import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'
import {
  getSetting,
  preloadRecentPointagesFromCloud,
  notifyPointagesChanged,
  upsertPointageInCache,
  removePointageFromCache,
  upsertSettingInCache,
  removeSettingFromCache
} from './db'
import { 
  configureSupabase,
  isSupabaseConfigured, 
  getSettingsFromSupabase, 
  subscribeToChanges 
} from './db/supabase'
import { useToast } from './composables/useToast'
import { CUSTOM_EVENTS, TOAST_DURATION } from './utils/constants'
import { dispatchCustomEvent } from './utils/dbHelpers'
import { syncLogger, realtimeLogger } from './utils/logger'

const { error: showError, warning: showWarning } = useToast()
let realtimeSubscription = null
let activeSupabaseFingerprint = ''

/**
 * Synchronisation initiale des pointages depuis le cloud
 */
async function syncInitialPointages() {
  try {
    const result = await preloadRecentPointagesFromCloud(45)

    if (!result.success) {
      syncLogger.error('Échec preload pointages cloud récents:', result.reason || 'unknown')
      showError('Échec de récupération des données cloud. Seules les données locales sont disponibles.', TOAST_DURATION.CRITICAL_ERROR)
      return
    }

    syncLogger.success('Préchargement cloud récent terminé')
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
      await upsertSettingInCache({
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
      
      await upsertPointageInCache({
        id: pointage.id,
        timestamp: pointage.timestamp,
        date: pointage.date
      })
      notifyPointagesChanged()
      
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
      await removePointageFromCache(deletedId)
      notifyPointagesChanged()
      
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
      await upsertSettingInCache({
        key: setting.key,
        value: setting.value
      })
      dispatchCustomEvent(CUSTOM_EVENTS.SETTING_UPDATED)
    } 
    else if (payload.eventType === 'DELETE') {
      await removeSettingFromCache(payload.old.key)
      dispatchCustomEvent(CUSTOM_EVENTS.SETTING_UPDATED)
    }
  } catch (error) {
    realtimeLogger.error('Erreur callback settings:', error)
    showError('Erreur de synchronisation paramètres', TOAST_DURATION.ERROR)
  }
}

async function initializeSupabaseFromUserSettings() {
  const supabaseUrl = await getSetting('supabaseUrl', '')
  const supabaseAnonKey = await getSetting('supabaseAnonKey', '')

  configureSupabase({
    url: supabaseUrl,
    anonKey: supabaseAnonKey
  })

  return {
    supabaseUrl,
    supabaseAnonKey,
    fingerprint: `${String(supabaseUrl).trim()}::${String(supabaseAnonKey).trim()}`
  }
}

async function bootstrapCloudSync() {
  const { fingerprint } = await initializeSupabaseFromUserSettings()

  if (!isSupabaseConfigured()) {
    if (realtimeSubscription) {
      realtimeSubscription.unsubscribe()
      realtimeSubscription = null
    }
    activeSupabaseFingerprint = ''
    syncLogger.info('Cloud désactivé: configuration Supabase absente')
    return
  }

  if (realtimeSubscription && activeSupabaseFingerprint === fingerprint) {
    return
  }

  if (realtimeSubscription) {
    realtimeSubscription.unsubscribe()
    realtimeSubscription = null
  }

  activeSupabaseFingerprint = fingerprint

  await syncInitialPointages()
  await syncInitialSettings()

  realtimeLogger.info('Abonnement aux changements real-time Supabase')
  realtimeSubscription = subscribeToChanges(handlePointageChange, handleSettingChange)
}

window.addEventListener(CUSTOM_EVENTS.SETTING_UPDATED, (event) => {
  const changedKey = event?.detail?.key
  if (changedKey === 'supabaseUrl' || changedKey === 'supabaseAnonKey') {
    bootstrapCloudSync()
  }
})

bootstrapCloudSync()

const app = createApp(App)
app.use(router)
app.mount('#app')
