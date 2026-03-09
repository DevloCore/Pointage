import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'
import { db } from './db'
import { isSupabaseConfigured, getPointagesFromSupabase, getSettingsFromSupabase, subscribeToChanges } from './db/supabase'
import { useToast } from './composables/useToast'

const { error: showError, warning: showWarning } = useToast()

// Synchronisation au démarrage
if (isSupabaseConfigured()) {
  // Récupérer les données du cloud au démarrage
  getPointagesFromSupabase().then(async result => {
    if (result.success && result.data) {
      console.log('📥 Sync initiale:', result.data.length, 'pointages du cloud')
      
      // Récupérer tous les IDs du cloud
      const cloudIds = result.data.map(p => p.id)
      console.log('☁️ IDs dans le cloud:', cloudIds)
      
      // Récupérer tous les pointages locaux
      const localPointages = await db.pointages.toArray()
      console.log('💾 IDs locaux:', localPointages.map(p => p.id))
      
      // Supprimer les pointages locaux qui n'existent plus dans le cloud
      for (const localPointage of localPointages) {
        if (!cloudIds.includes(localPointage.id)) {
          console.log('🗑️ Suppression locale du pointage orphelin:', localPointage.id)
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
      
      console.log('✅ Synchronisation initiale terminée')
      // Rafraîchir l'UI après la sync complète
      window.dispatchEvent(new CustomEvent('pointage-updated'))
    } else {
      console.error('❌ Échec sync initiale pointages:', result.error)
      showError('Échec de récupération des données cloud. Seules les données locales sont disponibles.', 8000)
    }
  }).catch(err => {
    console.error('❌ Exception sync initiale pointages:', err)
    showError('Erreur de connexion au cloud. Mode hors ligne activé.', 8000)
  })

  getSettingsFromSupabase().then(async result => {
    if (result.success && result.data) {
      for (const setting of result.data) {
        await db.settings.put({
          key: setting.key,
          value: setting.value
        })
      }
      // Déclencher l'événement pour rafraîchir l'UI
      window.dispatchEvent(new CustomEvent('setting-updated'))
    } else {
      console.error('❌ Échec sync initiale settings:', result.error)
      showWarning('Impossible de récupérer les paramètres cloud', 6000)
    }
  }).catch(err => {
    console.error('❌ Exception sync initiale settings:', err)
    showWarning('Erreur de connexion pour les paramètres', 6000)
  })

  // S'abonner aux changements en temps réel
  console.log('🔔 Abonnement aux changements real-time Supabase...')
  const subscription = subscribeToChanges(
    // Callback pour les pointages
    async (payload) => {
      console.log('🔄 [REALTIME] Changement pointage détecté:', {
        eventType: payload.eventType,
        old: payload.old,
        new: payload.new
      })
      
      try {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const pointage = payload.new
          console.log('➕ [REALTIME] Mise à jour/ajout pointage:', pointage.id)
          await db.pointages.put({
            id: pointage.id,
            timestamp: pointage.timestamp,
            date: pointage.date
          })
          // Déclencher un événement personnalisé pour rafraîchir l'UI
          window.dispatchEvent(new CustomEvent('pointage-updated'))
          console.log('✅ [REALTIME] Pointage mis à jour localement')
        } else if (payload.eventType === 'DELETE') {
          const deletedId = payload.old?.id
          console.log('🗑️ [REALTIME] Suppression pointage:', deletedId, 'Payload complet:', payload.old)
          if (deletedId) {
            const existsBefore = await db.pointages.get(deletedId)
            console.log('📍 [REALTIME] Pointage existe avant suppression?', existsBefore ? 'OUI' : 'NON')
            
            await db.pointages.delete(deletedId)
            
            const existsAfter = await db.pointages.get(deletedId)
            console.log('📍 [REALTIME] Pointage existe après suppression?', existsAfter ? 'OUI (PROBLEME!)' : 'NON (OK)')
            
            window.dispatchEvent(new CustomEvent('pointage-updated'))
            console.log('✅ [REALTIME] Suppression locale terminée')
          } else {
            console.error('❌ [REALTIME] ID de suppression manquant:', payload)
          }
        }
      } catch (error) {
        console.error('❌ [REALTIME] Erreur callback pointage:', error)
        showError('Erreur de synchronisation temps réel', 5000)
      }
    },
    // Callback pour les settings
    async (payload) => {
      console.log('Changement setting détecté:', payload)
      
      try {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const setting = payload.new
          await db.settings.put({
            key: setting.key,
            value: setting.value
          })
          window.dispatchEvent(new CustomEvent('setting-updated'))
        } else if (payload.eventType === 'DELETE') {
          await db.settings.delete(payload.old.key)
          window.dispatchEvent(new CustomEvent('setting-updated'))
        }
      } catch (error) {
        console.error('❌ [REALTIME] Erreur callback settings:', error)
        showError('Erreur de synchronisation paramètres', 5000)
      }
    }
  )
}

const app = createApp(App)
app.use(router)
app.mount('#app')
