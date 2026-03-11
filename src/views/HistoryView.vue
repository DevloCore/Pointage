<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import {
  addPointage,
  updatePointage,
  deletePointage,
  getPointagesByDateRange,
  getPointagesAllPage
} from '../db'
import { 
  ClockIcon, 
  PencilSquareIcon, 
  TrashIcon, 
  CheckIcon, 
  XMarkIcon 
} from '@heroicons/vue/24/outline'

const allPointages = ref([])
const activeTab = ref('day')
const hasMoreAll = ref(false)
const isLoading = ref(false)
const allPageSize = 40
const allOffset = ref(0)
const loadedIds = new Set()

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
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
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
  return sorted.map(([date, entries]) => {
    const sortedEntries = entries.sort((a, b) => a.timestamp - b.timestamp)
    const pairs = []
    for (let i = 0; i < sortedEntries.length; i += 2) {
      pairs.push({
        start: sortedEntries[i],
        end: sortedEntries[i + 1] || null
      })
    }
    return {
      date,
      label: formatDateLabel(date),
      entries: sortedEntries,
      pairs
    }
  })
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
  await updatePointage(entry.id, {
    timestamp: d.getTime(),
    date: d.toISOString().split('T')[0]
  })
  editingId.value = null
  // Le refresh sera déclenché par loadAll via l'événement
}

function cancelEdit() {
  editingId.value = null
}

async function deleteEntry(id) {
  console.log('Suppression de l\'entrée:', id)
  await deletePointage(id)
  // Le refresh sera déclenché par l'événement 'pointage-updated'
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
  await addPointage({
    timestamp: d.getTime(),
    date: addingDate.value
  })
  showAddForm.value = false
  // Le refresh sera déclenché par loadAll via l'événement
}

function getTodayRange() {
  const now = new Date()
  const date = now.toISOString().split('T')[0]
  return { start: date, end: date }
}

function getWeekRange() {
  const monday = getMonday(new Date())
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  return {
    start: formatDate(monday),
    end: formatDate(sunday)
  }
}

async function loadDay() {
  const { start, end } = getTodayRange()
  allPointages.value = await getPointagesByDateRange(start, end)
}

async function loadWeek() {
  const { start, end } = getWeekRange()
  allPointages.value = await getPointagesByDateRange(start, end)
}

function mergeUniquePointages(newItems, reset = false) {
  if (reset) {
    loadedIds.clear()
    allPointages.value = []
  }

  const merged = reset ? [] : [...allPointages.value]
  let addedCount = 0
  for (const item of newItems) {
    if (loadedIds.has(item.id)) continue
    loadedIds.add(item.id)
    merged.push(item)
    addedCount += 1
  }

  merged.sort((a, b) => b.timestamp - a.timestamp)
  allPointages.value = merged
  return addedCount
}

async function loadAllPage(reset = false) {
  if (reset) {
    mergeUniquePointages([], true)
    allOffset.value = 0
  }

  const page = await getPointagesAllPage(allPageSize, allOffset.value, {
    useCache: true,
    hydrateCloud: true
  })

  mergeUniquePointages(page.data, false)
  allOffset.value += page.data.length
  hasMoreAll.value = page.hasMore && page.data.length > 0
}

async function loadForActiveTab({ reset = true } = {}) {
  isLoading.value = true
  try {
    if (activeTab.value === 'day') {
      await loadDay()
      hasMoreAll.value = false
      return
    }

    if (activeTab.value === 'week') {
      await loadWeek()
      hasMoreAll.value = false
      return
    }

    await loadAllPage(reset)
  } finally {
    isLoading.value = false
  }
}

async function loadMoreAll() {
  if (activeTab.value !== 'all' || !hasMoreAll.value || isLoading.value) return
  await loadForActiveTab({ reset: false })
}

async function handlePointageUpdated() {
  // Un événement temps réel peut insérer/modifier des pointages récents;
  // on repart d'un chargement propre pour éviter un historique incohérent.
  await loadForActiveTab({ reset: true })
}

async function handleTabChange(tab) {
  if (activeTab.value === tab) return
  activeTab.value = tab
  await loadForActiveTab({ reset: true })
}

// Charger au démarrage
onMounted(async () => {
  await loadForActiveTab({ reset: true })
  // Écouter les changements en temps réel
  window.addEventListener('pointage-updated', handlePointageUpdated)
})

// Nettoyer les listeners
onUnmounted(() => {
  window.removeEventListener('pointage-updated', handlePointageUpdated)
})

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
        @click="handleTabChange(tab.key)"
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
      <ClockIcon class="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>Aucun pointage</p>
    </div>

    <div v-for="group in groupedEntries" :key="group.date" class="mb-6">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide capitalize">{{ group.label }}</h3>
        <span class="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{{ formatDuration(computeWorkedMs(group.entries)) }}</span>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow divide-y divide-gray-100 dark:divide-gray-700">
        <div v-for="(pair, pairIndex) in group.pairs" :key="pairIndex" class="px-4 py-3">
          <!-- Pair view: start → end -->
          <div v-if="editingId !== pair.start.id && (pair.end === null || editingId !== pair.end.id)">
            <!-- Start time row -->
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-2 min-w-[80px]">
                  <ClockIcon class="w-4 h-4 text-green-500" />
                  <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Début</span>
                </div>
                <span class="font-mono text-lg font-semibold">{{ formatTime(pair.start.timestamp) }}</span>
              </div>
              <div class="flex gap-1">
                <button @click="startEdit(pair.start)" class="p-1.5 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Modifier l'heure de début">
                  <PencilSquareIcon class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </button>
                <button @click="deleteEntry(pair.start.id)" class="p-1.5 hover:bg-red-50 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Supprimer le début">
                  <TrashIcon class="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>

            <!-- End time row -->
            <div v-if="pair.end" class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-2 min-w-[80px]">
                  <ClockIcon class="w-4 h-4 text-red-500" />
                  <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Fin</span>
                </div>
                <span class="font-mono text-lg font-semibold">{{ formatTime(pair.end.timestamp) }}</span>
              </div>
              <div class="flex gap-1">
                <button @click="startEdit(pair.end)" class="p-1.5 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Modifier l'heure de fin">
                  <PencilSquareIcon class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </button>
                <button @click="deleteEntry(pair.end.id)" class="p-1.5 hover:bg-red-50 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Supprimer la fin">
                  <TrashIcon class="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>

            <!-- In progress indicator -->
            <div v-else class="flex items-center gap-3">
              <div class="flex items-center gap-2 min-w-[80px]">
                <ClockIcon class="w-4 h-4 text-amber-500 animate-pulse" />
                <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Fin</span>
              </div>
              <span class="text-sm font-medium text-amber-500 animate-pulse">En cours...</span>
            </div>
          </div>

          <!-- Edit mode for start entry -->
          <div v-else-if="editingId === pair.start.id" class="space-y-2">
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-2 min-w-[80px]">
                <ClockIcon class="w-4 h-4 text-green-500" />
                <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Début</span>
              </div>
              <select v-model.number="editHour" class="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option v-for="h in hours" :key="h" :value="h">{{ String(h).padStart(2, '0') }}</option>
              </select>
              <span class="font-bold">:</span>
              <select v-model.number="editMinute" class="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option v-for="m in minutes" :key="m" :value="m">{{ String(m).padStart(2, '0') }}</option>
              </select>
              <button @click="saveEdit(pair.start)" class="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors" title="Valider">
                <CheckIcon class="w-4 h-4" />
              </button>
              <button @click="cancelEdit" class="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Annuler">
                <XMarkIcon class="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          <!-- Edit mode for end entry -->
          <div v-else-if="pair.end && editingId === pair.end.id" class="space-y-2">
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-2 min-w-[80px]">
                <ClockIcon class="w-4 h-4 text-red-500" />
                <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Fin</span>
              </div>
              <select v-model.number="editHour" class="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option v-for="h in hours" :key="h" :value="h">{{ String(h).padStart(2, '0') }}</option>
              </select>
              <span class="font-bold">:</span>
              <select v-model.number="editMinute" class="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option v-for="m in minutes" :key="m" :value="m">{{ String(m).padStart(2, '0') }}</option>
              </select>
              <button @click="saveEdit(pair.end)" class="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors" title="Valider">
                <CheckIcon class="w-4 h-4" />
              </button>
              <button @click="cancelEdit" class="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Annuler">
                <XMarkIcon class="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'all'" class="pb-8 text-center text-sm text-gray-500 dark:text-gray-400">
      <span v-if="isLoading">Chargement...</span>
      <div v-else-if="hasMoreAll" class="flex flex-col items-center gap-3">
        <span>{{ allPageSize }} pointages par page</span>
        <button
          @click="loadMoreAll"
          class="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-xl transition-colors"
        >
          Charger plus
        </button>
      </div>
      <span v-else>Fin de l'historique</span>
    </div>
  </div>
</template>
