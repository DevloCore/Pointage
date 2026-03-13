import { createClient } from '@supabase/supabase-js'
import { ref, readonly } from 'vue'
import { supabaseLogger } from '../utils/logger'

let supabase = null
const supabaseConfigured = ref(false)

export const supabaseConfiguredRef = readonly(supabaseConfigured)

/**
 * Configure dynamiquement le client Supabase depuis les paramètres utilisateur.
 */
export function configureSupabase({ url = '', anonKey = '' } = {}) {
  const cleanUrl = String(url).trim()
  const cleanAnonKey = String(anonKey).trim()

  if (!cleanUrl || !cleanAnonKey) {
    supabase = null
    supabaseConfigured.value = false
    supabaseLogger.info('Supabase désactivé: URL ou clé manquante')
    return false
  }

  try {
    supabase = createClient(cleanUrl, cleanAnonKey)
    supabaseConfigured.value = true
    supabaseLogger.success('Client Supabase configuré')
    return true
  } catch (error) {
    supabase = null
    supabaseConfigured.value = false
    supabaseLogger.error('Configuration Supabase invalide:', error)
    return false
  }
}

/**
 * Teste la connexion Supabase sans modifier le client global.
 */
export async function testSupabaseConnection({ url = '', anonKey = '' } = {}) {
  const cleanUrl = String(url).trim()
  const cleanAnonKey = String(anonKey).trim()

  if (!cleanUrl || !cleanAnonKey) {
    return { success: false, error: 'URL ou clé Supabase manquante' }
  }

  try {
    const testClient = createClient(cleanUrl, cleanAnonKey)
    const { error } = await testClient
      .from('settings')
      .select('key')
      .limit(1)

    if (error) {
      throw error
    }

    return { success: true }
  } catch (error) {
    supabaseLogger.error('Test connexion Supabase échoué:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Vérifie si Supabase est configuré
 */
export const isSupabaseConfigured = () => supabaseConfigured.value

/**
 * Fonction générique pour exécuter une opération Supabase avec gestion d'erreur
 */
async function executeSupabaseOperation(operationName, operation) {
  if (!supabase) {
    supabaseLogger.warn(`${operationName}: Supabase non configuré`)
    return { success: false, error: 'Supabase non configuré' }
  }

  try {
    supabaseLogger.debug(`${operationName}: Début`)
    const result = await operation()
    if (result.error) throw result.error
    supabaseLogger.success(`${operationName}: Succès`)
    return { success: true, data: result.data }
  } catch (error) {
    supabaseLogger.error(`${operationName}:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Synchronise les pointages vers Supabase
 */
export async function syncPointagesToSupabase(pointages) {
  return executeSupabaseOperation('Sync Pointages', async () => {
    return supabase
      .from('pointages')
      .upsert(pointages.map(p => ({
        id: p.id,
        timestamp: p.timestamp,
        date: p.date,
        synced_at: new Date().toISOString()
      })))
      .select()
  })
}

/**
 * Récupère les pointages depuis Supabase
 */
export async function getPointagesFromSupabase() {
  return executeSupabaseOperation('Get Pointages', async () => {
    return supabase
      .from('pointages')
      .select('*')
      .order('timestamp', { ascending: false })
  })
}

/**
 * Récupère les pointages depuis Supabase sur une plage de dates [startDate, endDate]
 */
export async function getPointagesFromSupabaseByDateRange(startDate, endDate) {
  return executeSupabaseOperation('Get Pointages By Date Range', async () => {
    return supabase
      .from('pointages')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('timestamp', { ascending: false })
  })
}

/**
 * Récupère une page de pointages depuis Supabase (tri timestamp desc).
 */
export async function getPointagesFromSupabasePage(offset = 0, limit = 40) {
  return executeSupabaseOperation('Get Pointages Page', async () => {
    return supabase
      .from('pointages')
      .select('*')
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1)
  })
}

/**
 * Récupère la date du pointage le plus ancien côté Supabase.
 */
export async function getOldestPointageDateFromSupabase() {
  return executeSupabaseOperation('Get Oldest Pointage Date', async () => {
    return supabase
      .from('pointages')
      .select('date')
      .order('date', { ascending: true })
      .limit(1)
  })
}

/**
 * Synchronise les paramètres vers Supabase
 */
export async function syncSettingsToSupabase(settings) {
  return executeSupabaseOperation('Sync Settings', async () => {
    return supabase
      .from('settings')
      .upsert(settings)
      .select()
  })
}

/**
 * Récupère les paramètres depuis Supabase
 */
export async function getSettingsFromSupabase() {
  return executeSupabaseOperation('Get Settings', async () => {
    return supabase
      .from('settings')
      .select('*')
  })
}

/**
 * Supprime un pointage dans Supabase
 */
export async function deletePointageFromSupabase(id) {
  return executeSupabaseOperation('Delete Pointage', async () => {
    return supabase
      .from('pointages')
      .delete()
      .eq('id', id)
  })
}

/**
 * S'abonne aux changements en temps réel
 */
export function subscribeToChanges(onPointageChange, onSettingChange) {
  if (!supabase) {
    supabaseLogger.warn('subscribeToChanges: Supabase non configuré')
    return null
  }

  supabaseLogger.info('Création des subscriptions real-time')

  const pointagesSubscription = supabase
    .channel('pointages-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pointages' },
      (payload) => {
        supabaseLogger.realtime('Événement pointages:', payload.eventType)
        if (onPointageChange) onPointageChange(payload)
      }
    )
    .subscribe((status) => {
      supabaseLogger.info('Statut subscription pointages:', status)
    })

  const settingsSubscription = supabase
    .channel('settings-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'settings' },
      (payload) => {
        supabaseLogger.realtime('Événement settings:', payload.eventType)
        if (onSettingChange) onSettingChange(payload)
      }
    )
    .subscribe((status) => {
      supabaseLogger.info('Statut subscription settings:', status)
    })

  return {
    unsubscribe: () => {
      supabaseLogger.info('Désabonnement des canaux real-time')
      supabase.removeChannel(pointagesSubscription)
      supabase.removeChannel(settingsSubscription)
    }
  }
}
