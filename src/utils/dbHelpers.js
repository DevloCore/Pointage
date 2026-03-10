/**
 * Helper pour gérer les opérations avec rollback automatique
 */

import { useToast } from '../composables/useToast'
import { TOAST_DURATION, CUSTOM_EVENTS } from './constants'
import { dbLogger } from './logger'

const { error: showError } = useToast()

/**
 * Exécute une opération avec rollback automatique en cas d'échec
 * @param {Object} options
 * @param {Function} options.operation - Opération à exécuter
 * @param {Function} options.rollback - Fonction de rollback en cas d'échec
 * @param {Function} options.syncOperation - Opération de synchronisation
 * @param {string} options.errorMessage - Message d'erreur à afficher
 * @param {string} options.eventName - Nom de l'événement à déclencher
 * @param {boolean} options.shouldSync - Si la synchronisation doit être effectuée
 * @returns {Promise<any>} Résultat de l'opération
 */
export async function executeWithRollback({
  operation,
  rollback,
  syncOperation = null,
  errorMessage = 'Opération échouée',
  eventName = CUSTOM_EVENTS.POINTAGE_UPDATED,
  shouldSync = true
}) {
  let result
  
  try {
    // Exécuter l'opération principale
    result = await operation()
    
    // Synchroniser avec le cloud si nécessaire
    if (shouldSync && syncOperation) {
      try {
        const syncResult = await syncOperation()
        if (!syncResult.success) {
          throw new Error(syncResult.error || 'Sync failed')
        }
      } catch (syncError) {
        dbLogger.error('Sync failed, rolling back:', syncError)
        // Rollback en cas d'échec de sync
        if (rollback) {
          await rollback()
        }
        showError(`${errorMessage}. Modification annulée.`, TOAST_DURATION.LONG_ERROR)
        window.dispatchEvent(new CustomEvent(eventName))
        throw syncError
      }
    }
    
    // Déclencher l'événement de mise à jour
    window.dispatchEvent(new CustomEvent(eventName))
    
    return result
  } catch (error) {
    dbLogger.error('Operation failed:', error)
    
    // Rollback si fourni et si pas déjà fait
    if (rollback && !syncOperation) {
      await rollback()
      window.dispatchEvent(new CustomEvent(eventName))
    }
    
    if (syncOperation) {
      // L'erreur a déjà été gérée dans le bloc sync
      throw error
    } else {
      showError(errorMessage, TOAST_DURATION.ERROR)
      throw error
    }
  }
}

/**
 * Crée un wrapper pour une opération de base de données avec gestion d'erreur
 * @param {string} operationName - Nom de l'opération pour les logs
 * @returns {Function} Fonction wrapper
 */
export function createDbOperation(operationName) {
  return async (fn) => {
    try {
      dbLogger.debug(`${operationName} starting`)
      const result = await fn()
      dbLogger.success(`${operationName} completed`)
      return result
    } catch (error) {
      dbLogger.error(`${operationName} failed:`, error)
      throw error
    }
  }
}

/**
 * Dispatch un événement personnalisé
 * @param {string} eventName - Nom de l'événement
 * @param {any} detail - Détails de l'événement
 */
export function dispatchCustomEvent(eventName, detail = null) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }))
}
