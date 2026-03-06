<script setup>
import { ref, onMounted, computed } from 'vue'
import { db } from '../db'

const allPointages = ref([])
const activeTab = ref('day')

const editingId = ref(null)
const editHour = ref(0)
const editMinute = ref(0)

const addingDate = ref('')
const addHour = ref(8)
const addMinute = ref(0)
const showAddForm = ref(false)

function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(date.setDate(diff))
}

function formatDate(d) {
  return d.toISOString().split('T')[0]
}

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

const todayStr = formatDate(new Date())

const weekDates = computed(() => {
  const monday = getMonday(new Date())
  const dates = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    dates.push(formatDate(d))
  }
  return dates
})

const dayEntries = computed(() => {
  return allPointages.value
    .filter(p => p.date === todayStr)
    .sort((a, b) => a.timestamp - b.timestamp)
})

const weekEntries = computed(() => {
  return allPointages.value
    .filter(p => weekDates.value.includes(p.date))
    .sort((a, b) => a.timestamp - b.timestamp)
})

const allEntries = computed(() => {
  return [...allPointages.value].sort((a, b) => b.timestamp - a.timestamp)
})

const currentEntries = computed(() => {
  if (activeTab.value === 'day') return dayEntries.value
  if (activeTab.value === 'week') return weekEntries.value
  return allEntries.value
})

const groupedEntries = computed(() => {
  const groups = {}
  for (const entry of currentEntries.value) {
    if (!groups[entry.date]) groups[entry.date] = []
    groups[entry.date].push(entry)
  }
  const sorted = Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  return sorted.map(([date, entries]) => ({
    date,
    label: formatDateLabel(date),
    entries: entries.sort((a, b) => a.timestamp - b.timestamp)
  }))
})

function computeWorkedMs(entries) {
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp)
  let total = 0
  for (let i = 0; i < sorted.length - 1; i += 2) {
    total += sorted[i + 1].timestamp - sorted[i].timestamp
  }
  return total
}

function formatDuration(ms) {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return `${hours}h ${String(minutes).padStart(2, '0')}min`
}

function startEdit(entry) {
  editingId.value = entry.id
  const d = new Date(entry.timestamp)
  editHour.value = d.getHours()
  editMinute.value = d.getMinutes()
}

async function saveEdit(entry) {
  const d = new Date(entry.timestamp)
  d.setHours(editHour.value, editMinute.value, 0, 0)
  await db.pointages.update(entry.id, {
    timestamp: d.getTime(),
    date: d.toISOString().split('T')[0]
  })
  editingId.value = null
  await loadAll()
}

function cancelEdit() {
  editingId.value = null
}

async function deleteEntry(id) {
  await db.pointages.delete(id)
  await loadAll()
}

function openAddForm() {
  addingDate.value = todayStr
  addHour.value = 8
  addMinute.value = 0
  showAddForm.value = true
}

async function confirmAdd() {
  const d = new Date(addingDate.value + 'T00:00:00')
  d.setHours(addHour.value, addMinute.value, 0, 0)
  await db.pointages.add({
    timestamp: d.getTime(),
    date: addingDate.value
  })
  showAddForm.value = false
  await loadAll()
}

async function loadAll() {
  allPointages.value = await db.pointages.toArray()
}

onMounted(loadAll)

const hours = Array.from({ length: 24 }, (_, i) => i)
const minutes = Array.from({ length: 60 }, (_, i) => i)
</script>

<template>
  <div class="max-w-lg mx-auto px-4 pt-6">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">Historique</h1>
      <button
        @click="openAddForm"
        class="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
      >
        + Ajouter
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-6">
      <button
        v-for="tab in [{ key: 'day', label: 'Jour' }, { key: 'week', label: 'Semaine' }, { key: 'all', label: 'Tout' }]"
        :key="tab.key"
        @click="activeTab = tab.key"
        class="flex-1 py-2 text-sm font-medium rounded-lg transition-colors"
        :class="activeTab === tab.key
          ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
          : 'text-gray-500 dark:text-gray-400'"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Add form modal -->
    <div v-if="showAddForm" class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 mb-4">
      <h3 class="font-semibold mb-3">Ajouter un pointage</h3>
      <div class="space-y-3">
        <div>
          <label class="text-sm text-gray-500 dark:text-gray-400">Date</label>
          <input
            v-model="addingDate"
            type="date"
            class="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div class="flex gap-3">
          <div class="flex-1">
            <label class="text-sm text-gray-500 dark:text-gray-400">Heure</label>
            <select v-model.number="addHour" class="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option v-for="h in hours" :key="h" :value="h">{{ String(h).padStart(2, '0') }}</option>
            </select>
          </div>
          <div class="flex-1">
            <label class="text-sm text-gray-500 dark:text-gray-400">Minute</label>
            <select v-model.number="addMinute" class="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option v-for="m in minutes" :key="m" :value="m">{{ String(m).padStart(2, '0') }}</option>
            </select>
          </div>
        </div>
        <div class="flex gap-2 pt-2">
          <button @click="confirmAdd" class="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-2 rounded-lg transition-colors">Ajouter</button>
          <button @click="showAddForm = false" class="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium py-2 rounded-lg transition-colors">Annuler</button>
        </div>
      </div>
    </div>

    <!-- Entries -->
    <div v-if="groupedEntries.length === 0" class="text-center text-gray-500 dark:text-gray-400 py-12">
      <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p>Aucun pointage</p>
    </div>

    <div v-for="group in groupedEntries" :key="group.date" class="mb-6">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide capitalize">{{ group.label }}</h3>
        <span class="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{{ formatDuration(computeWorkedMs(group.entries)) }}</span>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow divide-y divide-gray-100 dark:divide-gray-700">
        <div v-for="entry in group.entries" :key="entry.id" class="px-4 py-3">
          <!-- View mode -->
          <div v-if="editingId !== entry.id" class="flex items-center justify-between">
            <span class="font-mono text-lg">{{ formatTime(entry.timestamp) }}</span>
            <div class="flex gap-2">
              <button @click="startEdit(entry)" class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm transition-colors">
                Modifier
              </button>
              <button @click="deleteEntry(entry.id)" class="text-red-500 hover:text-red-700 text-sm transition-colors">
                Supprimer
              </button>
            </div>
          </div>

          <!-- Edit mode -->
          <div v-else class="flex items-center gap-3">
            <select v-model.number="editHour" class="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option v-for="h in hours" :key="h" :value="h">{{ String(h).padStart(2, '0') }}</option>
            </select>
            <span class="font-bold">:</span>
            <select v-model.number="editMinute" class="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option v-for="m in minutes" :key="m" :value="m">{{ String(m).padStart(2, '0') }}</option>
            </select>
            <button @click="saveEdit(entry)" class="text-green-500 hover:text-green-700 text-sm font-medium transition-colors">OK</button>
            <button @click="cancelEdit" class="text-gray-400 hover:text-gray-600 text-sm transition-colors">✕</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
