import { createClient } from '@supabase/supabase-js'
import { supabaseLogger } from '../utils/logger'

// Configuration Supabase
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

/**
 * Vérifie si Supabase est configuré
 */
export const isSupabaseConfigured = () => supabase !== null

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
