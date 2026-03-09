import { createClient } from '@supabase/supabase-js'

// Configuration Supabase
// TODO: Remplacer avec vos vraies valeurs depuis https://supabase.com/dashboard
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

// Vérifier si Supabase est configuré
export const isSupabaseConfigured = () => {
  return supabase !== null
}

// Fonction pour synchroniser les pointages locaux vers Supabase
export async function syncPointagesToSupabase(pointages) {
  if (!supabase) {
    console.warn('Supabase non configuré')
    return { success: false, error: 'Supabase non configuré' }
  }

  try {
    const { data, error } = await supabase
      .from('pointages')
      .upsert(pointages.map(p => ({
        id: p.id,
        timestamp: p.timestamp,
        date: p.date,
        synced_at: new Date().toISOString()
      })))
      .select()

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Erreur sync vers Supabase:', error)
    return { success: false, error: error.message }
  }
}

// Fonction pour récupérer les pointages depuis Supabase
export async function getPointagesFromSupabase() {
  if (!supabase) {
    return { success: false, error: 'Supabase non configuré' }
  }

  try {
    const { data, error } = await supabase
      .from('pointages')
      .select('*')
      .order('timestamp', { ascending: false })

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Erreur récupération depuis Supabase:', error)
    return { success: false, error: error.message }
  }
}

// Fonction pour synchroniser les paramètres vers Supabase
export async function syncSettingsToSupabase(settings) {
  if (!supabase) {
    return { success: false, error: 'Supabase non configuré' }
  }

  try {
    const { data, error } = await supabase
      .from('settings')
      .upsert(settings)
      .select()

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Erreur sync settings vers Supabase:', error)
    return { success: false, error: error.message }
  }
}

// Fonction pour récupérer les paramètres depuis Supabase
export async function getSettingsFromSupabase() {
  if (!supabase) {
    return { success: false, error: 'Supabase non configuré' }
  }

  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Erreur récupération settings depuis Supabase:', error)
    return { success: false, error: error.message }
  }
}

// Fonction pour supprimer un pointage dans Supabase
export async function deletePointageFromSupabase(id) {
  if (!supabase) {
    return { success: false, error: 'Supabase non configuré' }
  }

  try {
    const { error } = await supabase
      .from('pointages')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Erreur suppression depuis Supabase:', error)
    return { success: false, error: error.message }
  }
}

// S'abonner aux changements en temps réel
export function subscribeToChanges(onPointageChange, onSettingChange) {
  if (!supabase) {
    console.warn('⚠️ subscribeToChanges: Supabase non configuré')
    return null
  }

  console.log('🔔 Création des subscriptions real-time...')

  const pointagesSubscription = supabase
    .channel('pointages-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pointages' },
      (payload) => {
        console.log('📡 [SUPABASE] Événement reçu sur canal pointages:', payload)
        if (onPointageChange) onPointageChange(payload)
      }
    )
    .subscribe((status) => {
      console.log('📡 [SUPABASE] Statut subscription pointages:', status)
    })

  const settingsSubscription = supabase
    .channel('settings-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'settings' },
      (payload) => {
        console.log('📡 [SUPABASE] Événement reçu sur canal settings:', payload)
        if (onSettingChange) onSettingChange(payload)
      }
    )
    .subscribe((status) => {
      console.log('📡 [SUPABASE] Statut subscription settings:', status)
    })

  return {
    unsubscribe: () => {
      console.log('🔕 Désabonnement des canaux real-time')
      supabase.removeChannel(pointagesSubscription)
      supabase.removeChannel(settingsSubscription)
    }
  }
}
