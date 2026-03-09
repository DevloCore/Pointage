import Dexie from 'dexie'
import { syncPointagesToSupabase, syncSettingsToSupabase, deletePointageFromSupabase, isSupabaseConfigured } from './supabase'
import { useToast } from '../composables/useToast'

const { error: showError } = useToast()

export const db = new Dexie('PointageDB')

db.version(1).stores({
  pointages: '++id, timestamp, date',
  settings: 'key'
})

export async function getSetting(key, defaultValue = null) {
  const row = await db.settings.get(key)
  return row ? row.value : defaultValue
}

export async function setSetting(key, value) {
  // Sauvegarder la valeur actuelle pour rollback
  const originalSetting = await db.settings.get(key)
  
  const settingData = { key, value }
  await db.settings.put(settingData)
  
  // Sync vers Supabase
  if (isSupabaseConfigured()) {
    try {
      const result = await syncSettingsToSupabase([settingData])
      if (!result.success) {
        // Rollback : restaurer l'ancienne valeur
        console.error('❌ Échec sync setting, rollback...')
        if (originalSetting) {
          await db.settings.put(originalSetting)
        } else {
          await db.settings.delete(key)
        }
        showError('Échec de synchronisation du paramètre', 5000)
        throw new Error('Setting sync failed: ' + result.error)
      }
    } catch (error) {
      console.error('❌ Exception sync setting:', error)
      if (originalSetting) {
        await db.settings.put(originalSetting)
      } else {
        await db.settings.delete(key)
      }
      showError('Erreur de synchronisation. Paramètre non enregistré.', 5000)
      throw error
    }
  }
}

// Fonction helper pour ajouter un pointage avec sync automatique
export async function addPointage(pointageData) {
  const id = await db.pointages.add(pointageData)
  
  // Sync vers Supabase
  if (isSupabaseConfigured()) {
    try {
      const result = await syncPointagesToSupabase([{ id, ...pointageData }])
      if (!result.success) {
        // Rollback : supprimer le pointage local
        console.error('❌ Échec sync Supabase, rollback...')
        await db.pointages.delete(id)
        showError('Échec de synchronisation cloud. Le pointage n\'a pas été enregistré.', 7000)
        window.dispatchEvent(new CustomEvent('pointage-updated'))
        throw new Error('Sync failed: ' + result.error)
      }
    } catch (error) {
      console.error('❌ Exception sync:', error)
      await db.pointages.delete(id)
      showError('Erreur de synchronisation. Veuillez réessayer.', 7000)
      window.dispatchEvent(new CustomEvent('pointage-updated'))
      throw error
    }
  }
  
  // Déclencher l'événement pour rafraîchir l'UI locale immédiatement
  window.dispatchEvent(new CustomEvent('pointage-updated'))
  
  return id
}

// Fonction helper pour mettre à jour un pointage avec sync automatique
export async function updatePointage(id, updates) {
  // Sauvegarder l'état actuel pour rollback
  const originalPointage = await db.pointages.get(id)
  if (!originalPointage) {
    showError('Pointage introuvable')
    throw new Error('Pointage not found')
  }
  
  // Appliquer la mise à jour localement
  await db.pointages.update(id, updates)
  
  // Récupérer le pointage complet pour la sync
  const pointage = await db.pointages.get(id)
  
  // Sync vers Supabase
  if (isSupabaseConfigured() && pointage) {
    try {
      const result = await syncPointagesToSupabase([pointage])
      if (!result.success) {
        // Rollback : restaurer l'état original
        console.error('❌ Échec sync Supabase, rollback...')
        await db.pointages.put(originalPointage)
        showError('Échec de synchronisation cloud. Modification annulée.', 7000)
        window.dispatchEvent(new CustomEvent('pointage-updated'))
        throw new Error('Sync failed: ' + result.error)
      }
    } catch (error) {
      console.error('❌ Exception sync:', error)
      await db.pointages.put(originalPointage)
      showError('Erreur de synchronisation. Modification annulée.', 7000)
      window.dispatchEvent(new CustomEvent('pointage-updated'))
      throw error
    }
  }
  
  // Déclencher l'événement pour rafraîchir l'UI locale immédiatement
  window.dispatchEvent(new CustomEvent('pointage-updated'))
}

// Fonction helper pour supprimer un pointage
export async function deletePointage(id) {
  console.log('🗑️ [LOCAL] Début suppression pointage:', id)
  
  // Sauvegarder le pointage pour rollback
  const originalPointage = await db.pointages.get(id)
  if (!originalPointage) {
    showError('Pointage introuvable')
    throw new Error('Pointage not found')
  }
  
  // Supprimer localement
  await db.pointages.delete(id)
  console.log('✅ [LOCAL] Pointage supprimé de IndexedDB')
  
  // Supprimer aussi dans Supabase
  if (isSupabaseConfigured()) {
    try {
      console.log('☁️ [LOCAL] Envoi suppression à Supabase...')
      const result = await deletePointageFromSupabase(id)
      if (!result.success) {
        // Rollback : restaurer le pointage
        console.error('❌ [LOCAL] Échec suppression Supabase, rollback...', result.error)
        await db.pointages.add(originalPointage)
        showError('Échec de synchronisation cloud. Suppression annulée.', 7000)
        window.dispatchEvent(new CustomEvent('pointage-updated'))
        throw new Error('Delete sync failed: ' + result.error)
      }
      console.log('✅ [LOCAL] Suppression Supabase réussie')
    } catch (error) {
      console.error('❌ [LOCAL] Exception suppression Supabase:', error)
      await db.pointages.add(originalPointage)
      showError('Erreur de synchronisation. Suppression annulée.', 7000)
      window.dispatchEvent(new CustomEvent('pointage-updated'))
      throw error
    }
  } else {
    console.log('⚠️ [LOCAL] Supabase non configuré, pas de sync cloud')
  }
  
  // Déclencher l'événement pour rafraîchir l'UI locale immédiatement
  console.log('🔔 [LOCAL] Déclenchement événement pointage-updated')
  window.dispatchEvent(new CustomEvent('pointage-updated'))
}
