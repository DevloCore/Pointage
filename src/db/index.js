import Dexie from 'dexie'

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
  await db.settings.put({ key, value })
}
