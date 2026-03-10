import Dexie from 'dexie'
import {
  syncPointagesToSupabase,
  syncSettingsToSupabase,
  deletePointageFromSupabase,
  getPointagesFromSupabaseByDateRange,
  getPointagesFromSupabasePage,
  getOldestPointageDateFromSupabase,
  isSupabaseConfigured
} from './supabase'
import { useToast } from '../composables/useToast'
import { executeWithRollback, dispatchCustomEvent } from '../utils/dbHelpers'
import { CUSTOM_EVENTS, TOAST_DURATION } from '../utils/constants'
import { dbLogger } from '../utils/logger'

const { error: showError } = useToast()

export const db = new Dexie('PointageDB')

const pointagesCache = new Map()
const hydratedCloudRanges = new Set()
const CACHE_TTL_MS = 30000
const oldestCloudDateCache = {
  value: null,
  ts: 0
}

db.version(1).stores({
  pointages: '++id, timestamp, date',
  settings: 'key'
})

function toDateKey(d) {
  return d.toISOString().split('T')[0]
}

function parseDateKey(dateKey) {
  return new Date(`${dateKey}T00:00:00`)
}

function shiftDateKey(dateKey, deltaDays) {
  const d = parseDateKey(dateKey)
  d.setDate(d.getDate() + deltaDays)
  return toDateKey(d)
}

function getMonthRangeFromDateKey(dateKey) {
  const d = parseDateKey(dateKey)
  const year = d.getFullYear()
  const month = d.getMonth()
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0)

  return {
    startDate: toDateKey(monthStart),
    endDate: toDateKey(monthEnd)
  }
}

function makeRangeKey(startDate, endDate) {
  return `${startDate}__${endDate}`
}

function makePageKey(limit, offset) {
  return `page__${limit}__${offset}`
}

function invalidatePointagesCache() {
  pointagesCache.clear()
}

export function notifyPointagesChanged() {
  invalidatePointagesCache()
  hydratedCloudRanges.clear()
  oldestCloudDateCache.ts = 0
}

async function hydrateRangeFromCloud(startDate, endDate) {
  if (!isSupabaseConfigured()) return { fetchedCount: 0 }

  const rangeKey = makeRangeKey(startDate, endDate)
  if (hydratedCloudRanges.has(rangeKey)) return { fetchedCount: 0 }

  const result = await getPointagesFromSupabaseByDateRange(startDate, endDate)
  if (!result.success || !result.data) return { fetchedCount: 0 }

  for (const pointage of result.data) {
    await db.pointages.put({
      id: pointage.id,
      timestamp: pointage.timestamp,
      date: pointage.date
    })
  }

  hydratedCloudRanges.add(rangeKey)
  return { fetchedCount: result.data.length }
}

/**
 * Récupère des pointages sur une plage de dates avec cache mémoire court.
 */
export async function getPointagesByDateRange(startDate, endDate, options = {}) {
  const { useCache = true, hydrateCloud = true } = options
  const rangeKey = makeRangeKey(startDate, endDate)
  const now = Date.now()
  const cached = pointagesCache.get(rangeKey)

  if (useCache && cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.data
  }

  if (hydrateCloud) {
    await hydrateRangeFromCloud(startDate, endDate)
  }

  const data = await db.pointages
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray()

  pointagesCache.set(rangeKey, { ts: now, data })
  return data
}

/**
 * Retourne la date la plus ancienne connue (Dexie + Supabase si configuré).
 */
export async function getOldestPointageDate() {
  const localOldest = await db.pointages.orderBy('date').first()
  const localDate = localOldest?.date || null

  if (!isSupabaseConfigured()) {
    return localDate
  }

  const now = Date.now()
  if (oldestCloudDateCache.value && now - oldestCloudDateCache.ts < CACHE_TTL_MS) {
    if (!localDate) return oldestCloudDateCache.value
    return localDate < oldestCloudDateCache.value ? localDate : oldestCloudDateCache.value
  }

  const cloudResult = await getOldestPointageDateFromSupabase()
  const cloudDate = cloudResult.success && cloudResult.data?.[0]?.date
    ? cloudResult.data[0].date
    : null

  oldestCloudDateCache.value = cloudDate
  oldestCloudDateCache.ts = now

  if (!localDate) return cloudDate
  if (!cloudDate) return localDate
  return localDate < cloudDate ? localDate : cloudDate
}

/**
 * Charge un chunk d'historique correspondant a un mois civil complet.
 * Le curseur represente une date de reference, et le mois de cette date est charge.
 */
export async function getPointagesHistoryChunk(cursorEndDate, options = {}) {
  const { hydrateCloud = true, useCache = true } = options
  const endDate = cursorEndDate || toDateKey(new Date())
  const { startDate, endDate: monthEndDate } = getMonthRangeFromDateKey(endDate)

  const data = await getPointagesByDateRange(startDate, monthEndDate, { useCache, hydrateCloud })
  const sorted = [...data].sort((a, b) => b.timestamp - a.timestamp)

  return {
    data: sorted,
    startDate,
    endDate: monthEndDate,
    nextCursorEndDate: shiftDateKey(startDate, -1)
  }
}

/**
 * Récupère les N derniers pointages depuis le cache local Dexie.
 */
export async function getLatestPointages(limit = 200) {
  return db.pointages
    .orderBy('timestamp')
    .reverse()
    .limit(limit)
    .toArray()
}

/**
 * Récupère des pointages paginés depuis le cache local Dexie.
 */
export async function getPointagesPage(limit = 200, offset = 0) {
  return db.pointages
    .orderBy('timestamp')
    .reverse()
    .offset(offset)
    .limit(limit)
    .toArray()
}

async function hydratePointagesPageFromCloud(limit, offset) {
  if (!isSupabaseConfigured()) {
    return { fetchedCount: 0 }
  }

  const result = await getPointagesFromSupabasePage(offset, limit)
  if (!result.success || !result.data) {
    return { fetchedCount: 0 }
  }

  for (const pointage of result.data) {
    await db.pointages.put({
      id: pointage.id,
      timestamp: pointage.timestamp,
      date: pointage.date
    })
  }

  return { fetchedCount: result.data.length }
}

/**
 * Récupère une page de pointages pour l'onglet "Tout" avec cache et backfill cloud.
 */
export async function getPointagesAllPage(limit = 40, offset = 0, options = {}) {
  const { useCache = true, hydrateCloud = true } = options
  const pageKey = makePageKey(limit, offset)
  const now = Date.now()
  const cached = pointagesCache.get(pageKey)

  if (useCache && cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.data
  }

  let cloudFetched = 0
  if (hydrateCloud) {
    const cloud = await hydratePointagesPageFromCloud(limit, offset)
    cloudFetched = cloud.fetchedCount
  }

  const data = await getPointagesPage(limit, offset)
  const hasMore = isSupabaseConfigured()
    ? cloudFetched === limit || data.length === limit
    : data.length === limit

  const payload = {
    data,
    hasMore
  }

  pointagesCache.set(pageKey, { ts: now, data: payload })
  return payload
}

/**
 * Précharge une fenêtre récente de données cloud dans Dexie.
 */
export async function preloadRecentPointagesFromCloud(days = 45) {
  if (!isSupabaseConfigured()) return { success: false, reason: 'supabase-not-configured' }

  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - days)

  await hydrateRangeFromCloud(toDateKey(start), toDateKey(end))
  invalidatePointagesCache()
  return { success: true }
}

/**
 * Récupère un paramètre
 */
export async function getSetting(key, defaultValue = null) {
  const row = await db.settings.get(key)
  return row ? row.value : defaultValue
}

/**
 * Enregistre un paramètre avec synchronisation
 */
export async function setSetting(key, value) {
  const originalSetting = await db.settings.get(key)
  const settingData = { key, value }
  
  return executeWithRollback({
    operation: async () => {
      await db.settings.put(settingData)
      return settingData
    },
    rollback: async () => {
      if (originalSetting) {
        await db.settings.put(originalSetting)
      } else {
        await db.settings.delete(key)
      }
    },
    syncOperation: isSupabaseConfigured() 
      ? async () => syncSettingsToSupabase([settingData])
      : null,
    errorMessage: 'Échec de synchronisation du paramètre',
    eventName: CUSTOM_EVENTS.SETTING_UPDATED,
    shouldSync: isSupabaseConfigured()
  })
}

/**
 * Ajoute un pointage avec synchronisation automatique
 */
export async function addPointage(pointageData) {
  let addedId
  
  return executeWithRollback({
    operation: async () => {
      addedId = await db.pointages.add(pointageData)
      notifyPointagesChanged()
      return addedId
    },
    rollback: async () => {
      if (addedId) {
        await db.pointages.delete(addedId)
      }
    },
    syncOperation: isSupabaseConfigured()
      ? async () => syncPointagesToSupabase([{ id: addedId, ...pointageData }])
      : null,
    errorMessage: 'Échec de synchronisation cloud. Le pointage n\'a pas été enregistré',
    eventName: CUSTOM_EVENTS.POINTAGE_UPDATED,
    shouldSync: isSupabaseConfigured()
  })
}

/**
 * Met à jour un pointage avec synchronisation automatique
 */
export async function updatePointage(id, updates) {
  const originalPointage = await db.pointages.get(id)
  
  if (!originalPointage) {
    showError('Pointage introuvable', TOAST_DURATION.ERROR)
    throw new Error('Pointage not found')
  }
  
  return executeWithRollback({
    operation: async () => {
      await db.pointages.update(id, updates)
      notifyPointagesChanged()
      return await db.pointages.get(id)
    },
    rollback: async () => {
      await db.pointages.put(originalPointage)
    },
    syncOperation: isSupabaseConfigured()
      ? async () => {
          const pointage = await db.pointages.get(id)
          return syncPointagesToSupabase([pointage])
        }
      : null,
    errorMessage: 'Échec de synchronisation cloud. Modification annulée',
    eventName: CUSTOM_EVENTS.POINTAGE_UPDATED,
    shouldSync: isSupabaseConfigured()
  })
}

/**
 * Supprime un pointage avec synchronisation automatique
 */
export async function deletePointage(id) {
  const originalPointage = await db.pointages.get(id)
  
  if (!originalPointage) {
    showError('Pointage introuvable', TOAST_DURATION.ERROR)
    throw new Error('Pointage not found')
  }
  
  dbLogger.delete('Suppression pointage:', id)
  
  return executeWithRollback({
    operation: async () => {
      await db.pointages.delete(id)
      notifyPointagesChanged()
      dbLogger.success('Pointage supprimé de IndexedDB')
    },
    rollback: async () => {
      await db.pointages.add(originalPointage)
    },
    syncOperation: isSupabaseConfigured()
      ? async () => {
          dbLogger.cloud('Envoi suppression à Supabase')
          const result = await deletePointageFromSupabase(id)
          if (result.success) {
            dbLogger.success('Suppression Supabase réussie')
          }
          return result
        }
      : null,
    errorMessage: 'Échec de synchronisation cloud. Suppression annulée',
    eventName: CUSTOM_EVENTS.POINTAGE_UPDATED,
    shouldSync: isSupabaseConfigured()
  })
}
