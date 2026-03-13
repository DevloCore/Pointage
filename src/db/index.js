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
import { dispatchCustomEvent } from '../utils/dbHelpers'
import { CUSTOM_EVENTS, TOAST_DURATION } from '../utils/constants'
import { dbLogger } from '../utils/logger'
import { createPersistentMapCache, withCloudCacheFallback } from '../utils/cacheHelper'

const { warning: showWarning, error: showError } = useToast()

const POINTAGES_STORAGE_KEY = 'pointages-cache-v1'
const SETTINGS_STORAGE_KEY = 'settings-cache-v1'
const LEGACY_MIGRATION_KEY = 'pointages-cache-migrated-v1'
const CACHE_TTL_MS = 30000
const LOCAL_ONLY_SETTING_KEYS = new Set(['supabaseUrl', 'supabaseAnonKey'])

const pointagesCacheStorage = createPersistentMapCache(POINTAGES_STORAGE_KEY)
const settingsCacheStorage = createPersistentMapCache(SETTINGS_STORAGE_KEY)
const pointagesById = pointagesCacheStorage.map
const settingsByKey = settingsCacheStorage.map

const queryCache = new Map()
const hydratedCloudRanges = new Set()
const oldestCloudDateCache = {
  value: null,
  ts: 0
}

pointagesCacheStorage.load()
settingsCacheStorage.load()

migrateLegacyIndexedDbToCache().catch((error) => {
  dbLogger.warn('Legacy cache migration failed:', error)
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

function readStoreAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error || new Error('IndexedDB read failed'))
  })
}

async function readLegacyIndexedDb() {
  if (typeof indexedDB === 'undefined') {
    return { pointages: [], settings: [] }
  }

  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open('PointageDB')

    openRequest.onerror = () => reject(openRequest.error || new Error('IndexedDB open failed'))

    openRequest.onupgradeneeded = () => {
      resolve({ pointages: [], settings: [] })
    }

    openRequest.onsuccess = async () => {
      const legacyDb = openRequest.result
      const hasPointages = legacyDb.objectStoreNames.contains('pointages')
      const hasSettings = legacyDb.objectStoreNames.contains('settings')

      if (!hasPointages && !hasSettings) {
        legacyDb.close()
        resolve({ pointages: [], settings: [] })
        return
      }

      try {
        const stores = []
        if (hasPointages) stores.push('pointages')
        if (hasSettings) stores.push('settings')

        const tx = legacyDb.transaction(stores, 'readonly')
        const pointagesPromise = hasPointages ? readStoreAll(tx.objectStore('pointages')) : Promise.resolve([])
        const settingsPromise = hasSettings ? readStoreAll(tx.objectStore('settings')) : Promise.resolve([])
        const [pointages, settings] = await Promise.all([pointagesPromise, settingsPromise])

        tx.oncomplete = () => {
          legacyDb.close()
          resolve({ pointages, settings })
        }

        tx.onerror = () => {
          legacyDb.close()
          reject(tx.error || new Error('IndexedDB transaction failed'))
        }
      } catch (error) {
        legacyDb.close()
        reject(error)
      }
    }
  })
}

async function migrateLegacyIndexedDbToCache() {
  if (localStorage.getItem(LEGACY_MIGRATION_KEY) === '1') {
    return
  }

  const legacy = await readLegacyIndexedDb()

  if (legacy.pointages.length > 0) {
    mergePointagesToCache(legacy.pointages)
  }

  if (legacy.settings.length > 0) {
    for (const setting of legacy.settings) {
      if (!setting || !setting.key) continue
      settingsByKey.set(setting.key, setting.value)
    }
    persistSettings()
  }

  localStorage.setItem(LEGACY_MIGRATION_KEY, '1')
}

function invalidatePointagesCache() {
  queryCache.clear()
}

function persistPointages() {
  pointagesCacheStorage.persist()
}

function persistSettings() {
  settingsCacheStorage.persist()
}

function normalizePointage(pointage) {
  return {
    id: pointage.id,
    timestamp: Number(pointage.timestamp),
    date: pointage.date
  }
}

function getSortedPointagesDesc() {
  return Array.from(pointagesById.values()).sort((a, b) => b.timestamp - a.timestamp)
}

function getPointagesByDateRangeFromCache(startDate, endDate) {
  return Array.from(pointagesById.values()).filter((pointage) => {
    return pointage.date >= startDate && pointage.date <= endDate
  })
}

function mergePointagesToCache(pointages) {
  let changed = false

  for (const raw of pointages || []) {
    if (!raw || raw.id === undefined || !raw.date) continue
    const normalized = normalizePointage(raw)
    const existing = pointagesById.get(normalized.id)

    if (!existing || existing.timestamp !== normalized.timestamp || existing.date !== normalized.date) {
      pointagesById.set(normalized.id, normalized)
      changed = true
    }
  }

  if (changed) {
    persistPointages()
    invalidatePointagesCache()
  }
}

export function notifyPointagesChanged() {
  invalidatePointagesCache()
  hydratedCloudRanges.clear()
  oldestCloudDateCache.ts = 0
}

export async function upsertPointageInCache(pointage, options = {}) {
  if (!pointage || pointage.id === undefined) return null

  const normalized = normalizePointage(pointage)
  pointagesById.set(normalized.id, normalized)
  persistPointages()
  notifyPointagesChanged()

  if (options.emitEvent) {
    dispatchCustomEvent(CUSTOM_EVENTS.POINTAGE_UPDATED)
  }

  return normalized
}

export async function removePointageFromCache(id, options = {}) {
  const existed = pointagesById.delete(id)

  if (existed) {
    persistPointages()
    notifyPointagesChanged()
  }

  if (options.emitEvent) {
    dispatchCustomEvent(CUSTOM_EVENTS.POINTAGE_UPDATED)
  }

  return existed
}

export async function upsertSettingInCache(setting, options = {}) {
  if (!setting || !setting.key) return null

  const settingData = { key: setting.key, value: setting.value }
  settingsByKey.set(settingData.key, settingData.value)
  persistSettings()

  if (options.emitEvent) {
    dispatchCustomEvent(CUSTOM_EVENTS.SETTING_UPDATED)
  }

  return settingData
}

export async function removeSettingFromCache(key, options = {}) {
  const existed = settingsByKey.delete(key)

  if (existed) {
    persistSettings()
  }

  if (options.emitEvent) {
    dispatchCustomEvent(CUSTOM_EVENTS.SETTING_UPDATED)
  }

  return existed
}

async function hydrateRangeFromCloud(startDate, endDate) {
  if (!isSupabaseConfigured()) return { fetchedCount: 0 }

  const rangeKey = makeRangeKey(startDate, endDate)
  if (hydratedCloudRanges.has(rangeKey)) return { fetchedCount: 0 }

  const cloudResult = await withCloudCacheFallback({
    operationName: 'Get Pointages By Date Range',
    request: () => getPointagesFromSupabaseByDateRange(startDate, endDate),
    getCachedValue: () => getPointagesByDateRangeFromCache(startDate, endDate),
    onSuccess: async (data) => {
      mergePointagesToCache(data)
      hydratedCloudRanges.add(rangeKey)
    },
    fallbackMessage: 'Cloud indisponible, affichage du cache local.'
  })

  if (!cloudResult.success) {
    return { fetchedCount: 0 }
  }

  return { fetchedCount: cloudResult.data?.length || 0 }
}

/**
 * Récupère des pointages sur une plage de dates avec cache mémoire court.
 */
export async function getPointagesByDateRange(startDate, endDate, options = {}) {
  const { useCache = true, hydrateCloud = true } = options
  const rangeKey = makeRangeKey(startDate, endDate)
  const now = Date.now()
  const cached = queryCache.get(rangeKey)

  if (useCache && cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.data
  }

  if (hydrateCloud && isSupabaseConfigured()) {
    await hydrateRangeFromCloud(startDate, endDate)
  }

  const data = getPointagesByDateRangeFromCache(startDate, endDate)
  queryCache.set(rangeKey, { ts: now, data })
  return data
}

/**
 * Retourne la date la plus ancienne connue (cache + Supabase si configuré).
 */
export async function getOldestPointageDate() {
  const localOldest = Array.from(pointagesById.values()).sort((a, b) => a.date.localeCompare(b.date))[0]
  const localDate = localOldest?.date || null

  if (!isSupabaseConfigured()) {
    return localDate
  }

  const now = Date.now()
  if (oldestCloudDateCache.value && now - oldestCloudDateCache.ts < CACHE_TTL_MS) {
    if (!localDate) return oldestCloudDateCache.value
    return localDate < oldestCloudDateCache.value ? localDate : oldestCloudDateCache.value
  }

  const cloudResult = await withCloudCacheFallback({
    operationName: 'Get Oldest Pointage Date',
    request: () => getOldestPointageDateFromSupabase(),
    getCachedValue: () => null,
    fallbackMessage: 'Cloud indisponible, date la plus ancienne prise depuis le cache.'
  })

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
 * Charge un chunk d'historique correspondant à un mois civil complet.
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
 * Récupère les N derniers pointages depuis le cache local.
 */
export async function getLatestPointages(limit = 200) {
  return getSortedPointagesDesc().slice(0, limit)
}

/**
 * Récupère des pointages paginés depuis le cache local.
 */
export async function getPointagesPage(limit = 200, offset = 0) {
  return getSortedPointagesDesc().slice(offset, offset + limit)
}

async function hydratePointagesPageFromCloud(limit, offset) {
  if (!isSupabaseConfigured()) {
    return { fetchedCount: 0, success: false }
  }

  const cloudResult = await withCloudCacheFallback({
    operationName: 'Get Pointages Page',
    request: () => getPointagesFromSupabasePage(offset, limit),
    getCachedValue: () => getSortedPointagesDesc().slice(offset, offset + limit),
    onSuccess: async (data) => {
      mergePointagesToCache(data)
    },
    fallbackMessage: 'Cloud indisponible, affichage de la page en cache.'
  })

  return {
    fetchedCount: cloudResult.data?.length || 0,
    success: cloudResult.success
  }
}

/**
 * Récupère une page de pointages pour l'onglet "Tout" avec cache et fallback local.
 */
export async function getPointagesAllPage(limit = 40, offset = 0, options = {}) {
  const { useCache = true, hydrateCloud = true } = options
  const pageKey = makePageKey(limit, offset)
  const now = Date.now()
  const cached = queryCache.get(pageKey)

  if (useCache && cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.data
  }

  let cloudFetched = 0
  if (hydrateCloud && isSupabaseConfigured()) {
    const cloud = await hydratePointagesPageFromCloud(limit, offset)
    cloudFetched = cloud.fetchedCount
  }

  const data = await getPointagesPage(limit, offset)
  const hasMore = isSupabaseConfigured()
    ? cloudFetched === limit || data.length === limit
    : data.length === limit

  const payload = { data, hasMore }
  queryCache.set(pageKey, { ts: now, data: payload })
  return payload
}

/**
 * Précharge une fenêtre récente de données cloud dans le cache local.
 */
export async function preloadRecentPointagesFromCloud(days = 45) {
  if (!isSupabaseConfigured()) return { success: false, reason: 'supabase-not-configured' }

  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - days)

  try {
    await hydrateRangeFromCloud(toDateKey(start), toDateKey(end))
    invalidatePointagesCache()
    return { success: true }
  } catch (error) {
    showWarning('Cloud indisponible, affichage du cache local.', TOAST_DURATION.WARNING)
    return { success: false, reason: error.message }
  }
}

/**
 * Récupère un paramètre
 */
export async function getSetting(key, defaultValue = null) {
  if (settingsByKey.has(key)) {
    return settingsByKey.get(key)
  }
  return defaultValue
}

/**
 * Récupère tous les pointages actuellement en cache local.
 */
export async function getAllPointagesFromCache() {
  return getSortedPointagesDesc()
}

/**
 * Récupère tous les paramètres actuellement en cache local.
 */
export async function getAllSettingsFromCache(options = {}) {
  const { excludeLocalOnly = false } = options
  return Array.from(settingsByKey.entries())
    .filter(([key]) => !excludeLocalOnly || !LOCAL_ONLY_SETTING_KEYS.has(key))
    .map(([key, value]) => ({ key, value }))
}

/**
 * Enregistre un paramètre avec synchronisation cloud best-effort.
 */
export async function setSetting(key, value) {
  const settingData = { key, value }
  await upsertSettingInCache(settingData)

  const shouldSyncSetting = isSupabaseConfigured() && !LOCAL_ONLY_SETTING_KEYS.has(key)
  if (shouldSyncSetting) {
    const syncResult = await syncSettingsToSupabase([settingData])
    if (!syncResult.success) {
      showWarning('Paramètre sauvegardé en cache local, cloud indisponible.', TOAST_DURATION.WARNING)
      dbLogger.warn('Sync setting failed, local cache kept:', syncResult.error)
    }
  }

  dispatchCustomEvent(CUSTOM_EVENTS.SETTING_UPDATED, { key })
  return settingData
}

/**
 * Ajoute un pointage de facon atomique: aucun cache local si l'ecriture cloud echoue.
 */
export async function addPointage(pointageData) {
  const generatedId = pointageData.id ?? Date.now()
  const row = {
    id: generatedId,
    timestamp: Number(pointageData.timestamp),
    date: pointageData.date
  }

  if (!isSupabaseConfigured()) {
    showWarning('Configuration Supabase requise pour enregistrer un pointage.', TOAST_DURATION.WARNING)
    throw new Error('Supabase not configured')
  }

  const syncResult = await syncPointagesToSupabase([row])
  if (!syncResult.success) {
    showError('Echec du pointage: aucune donnee n\'a ete enregistree.', TOAST_DURATION.ERROR)
    dbLogger.warn('Sync add pointage failed, cache unchanged:', syncResult.error)
    throw new Error(syncResult.error || 'Failed to add pointage')
  }

  await upsertPointageInCache(row)

  dispatchCustomEvent(CUSTOM_EVENTS.POINTAGE_UPDATED)
  return row.id
}

/**
 * Met à jour un pointage avec cache local immédiat et synchronisation cloud best-effort.
 */
export async function updatePointage(id, updates) {
  const existing = pointagesById.get(id)

  if (!existing) {
    showError('Pointage introuvable', TOAST_DURATION.ERROR)
    throw new Error('Pointage not found')
  }

  const updated = {
    ...existing,
    ...updates
  }

  await upsertPointageInCache(updated)

  if (isSupabaseConfigured()) {
    const syncResult = await syncPointagesToSupabase([updated])
    if (!syncResult.success) {
      showWarning('Modification locale conservée, cloud indisponible.', TOAST_DURATION.WARNING)
      dbLogger.warn('Sync update pointage failed, cache kept:', syncResult.error)
    }
  }

  dispatchCustomEvent(CUSTOM_EVENTS.POINTAGE_UPDATED)
  return updated
}

/**
 * Supprime un pointage avec cache local immédiat et synchronisation cloud best-effort.
 */
export async function deletePointage(id) {
  const existing = pointagesById.get(id)

  if (!existing) {
    showError('Pointage introuvable', TOAST_DURATION.ERROR)
    throw new Error('Pointage not found')
  }

  await removePointageFromCache(id)

  if (isSupabaseConfigured()) {
    const syncResult = await deletePointageFromSupabase(id)
    if (!syncResult.success) {
      showWarning('Suppression locale conservée, cloud indisponible.', TOAST_DURATION.WARNING)
      dbLogger.warn('Sync delete pointage failed, cache kept:', syncResult.error)
    }
  }

  dispatchCustomEvent(CUSTOM_EVENTS.POINTAGE_UPDATED)
}
