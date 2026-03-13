import { useToast } from '../composables/useToast'
import { TOAST_DURATION } from './constants'
import { dbLogger } from './logger'

const { warning: showWarning } = useToast()

export function createPersistentMapCache(storageKey) {
  const map = new Map()

  function load() {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return

      map.clear()
      for (const entry of parsed) {
        if (!entry || typeof entry.key !== 'string') continue
        map.set(entry.key, entry.value)
      }
    } catch (error) {
      dbLogger.warn(`Cache load failed (${storageKey}):`, error)
    }
  }

  function persist() {
    try {
      const serialized = Array.from(map.entries()).map(([key, value]) => ({ key, value }))
      localStorage.setItem(storageKey, JSON.stringify(serialized))
    } catch (error) {
      dbLogger.error(`Cache persist failed (${storageKey}):`, error)
    }
  }

  return {
    map,
    load,
    persist
  }
}

export async function withCloudCacheFallback({
  operationName,
  request,
  getCachedValue,
  onSuccess,
  fallbackMessage = 'Cloud indisponible, affichage du cache local.'
}) {
  try {
    const result = await request()
    if (!result.success) {
      throw new Error(result.error || `${operationName} failed`)
    }

    if (onSuccess) {
      await onSuccess(result.data)
    }

    return {
      success: true,
      data: result.data,
      source: 'cloud'
    }
  } catch (error) {
    dbLogger.warn(`${operationName}: fallback cache`, error)
    showWarning(fallbackMessage, TOAST_DURATION.WARNING)

    return {
      success: false,
      data: getCachedValue ? getCachedValue() : null,
      source: 'cache',
      error: error.message
    }
  }
}
