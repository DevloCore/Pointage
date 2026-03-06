<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { db, getSetting } from '../db'

const todayPointages = ref([])
const weekPointages = ref([])
const weeklyHours = ref(35)
const workDays = ref([1, 2, 3, 4, 5])
const now = ref(Date.now())
let timerInterval = null

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

const todayWorked = computed(() => {
  return computeWorkedMs(todayPointages.value)
})

const weekWorked = computed(() => {
  return computeWorkedMs(weekPointages.value)
})

function computeWorkedMs(entries) {
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp)
  let total = 0
  for (let i = 0; i < sorted.length - 1; i += 2) {
    total += sorted[i + 1].timestamp - sorted[i].timestamp
  }
  if (sorted.length % 2 === 1) {
    total += now.value - sorted[sorted.length - 1].timestamp
  }
  return total
}

function formatDuration(ms) {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return `${hours}h ${String(minutes).padStart(2, '0')}min`
}

const weekProgress = computed(() => {
  const target = weeklyHours.value * 3600000
  if (target === 0) return 0
  return Math.min(100, Math.round((weekWorked.value / target) * 100))
})

const isWorking = computed(() => {
  return todayPointages.value.length % 2 === 1
})

const lastPointage = computed(() => {
  if (todayPointages.value.length === 0) return null
  const sorted = [...todayPointages.value].sort((a, b) => b.timestamp - a.timestamp)
  return sorted[0]
})

// Delta semaine: calculate the difference between actual worked time and expected time
// for each day that has already passed (or is in progress) this week
const weekDelta = computed(() => {
  const nbWorkDays = workDays.value.length
  if (nbWorkDays === 0) return 0

  const dailyExpectedMs = (weeklyHours.value / nbWorkDays) * 3600000
  const monday = getMonday(new Date())
  const today = new Date()
  const todayStr = formatDate(today)

  let totalExpected = 0
  let totalWorked = 0

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    const dateStr = formatDate(d)
    const dayOfWeek = d.getDay()

    // Only count work days that have passed or are today
    if (dateStr > todayStr) break
    if (!workDays.value.includes(dayOfWeek)) continue

    totalExpected += dailyExpectedMs

    // Get pointages for this day
    const dayEntries = weekPointages.value.filter(p => p.date === dateStr)
    const sorted = [...dayEntries].sort((a, b) => a.timestamp - b.timestamp)
    let dayWorked = 0
    for (let j = 0; j < sorted.length - 1; j += 2) {
      dayWorked += sorted[j + 1].timestamp - sorted[j].timestamp
    }
    // If currently working (odd entries on today)
    if (dateStr === todayStr && sorted.length % 2 === 1) {
      dayWorked += now.value - sorted[sorted.length - 1].timestamp
    }
    totalWorked += dayWorked
  }

  return totalWorked - totalExpected
})

function formatDelta(ms) {
  const absMs = Math.abs(ms)
  const hours = Math.floor(absMs / 3600000)
  const minutes = Math.floor((absMs % 3600000) / 60000)
  const sign = ms >= 0 ? '+' : '-'
  return `${sign}${hours}h ${String(minutes).padStart(2, '0')}min`
}

onMounted(async () => {
  const today = formatDate(new Date())
  todayPointages.value = await db.pointages.where('date').equals(today).toArray()

  const monday = getMonday(new Date())
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const dates = []
  for (let d = new Date(monday); d <= sunday; d.setDate(d.getDate() + 1)) {
    dates.push(formatDate(new Date(d)))
  }
  weekPointages.value = await db.pointages.where('date').anyOf(dates).toArray()

  weeklyHours.value = await getSetting('weeklyHours', 35)
  workDays.value = await getSetting('workDays', [1, 2, 3, 4, 5])

  timerInterval = setInterval(() => {
    now.value = Date.now()
  }, 10000)
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})
</script>

<template>
  <div class="max-w-lg mx-auto px-4 pt-6">
    <h1 class="text-2xl font-bold mb-6">Accueil</h1>

    <!-- Status card -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 mb-4">
      <div class="flex items-center gap-3 mb-3">
        <div
          class="w-3 h-3 rounded-full"
          :class="isWorking ? 'bg-green-500 animate-pulse' : 'bg-gray-400'"
        />
        <span class="font-medium">{{ isWorking ? 'En cours de travail' : 'Pas en cours' }}</span>
      </div>
      <p v-if="lastPointage" class="text-sm text-gray-500 dark:text-gray-400">
        Dernier pointage : {{ formatTime(lastPointage.timestamp) }}
      </p>
      <p v-else class="text-sm text-gray-500 dark:text-gray-400">Aucun pointage aujourd'hui</p>
    </div>

    <!-- Today -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 mb-4">
      <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Aujourd'hui</h2>
      <p class="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{{ formatDuration(todayWorked) }}</p>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ todayPointages.length }} pointage(s)</p>
    </div>

    <!-- Week -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 mb-4">
      <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Cette semaine</h2>
      <p class="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{{ formatDuration(weekWorked) }}</p>
      <div class="mt-3">
        <div class="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
          <span>Progression</span>
          <span>{{ weekProgress }}% de {{ weeklyHours }}h</span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div
            class="bg-indigo-600 dark:bg-indigo-400 h-2.5 rounded-full transition-all duration-500"
            :style="{ width: weekProgress + '%' }"
          />
        </div>
      </div>
    </div>

    <!-- Delta semaine -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 mb-4">
      <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Delta semaine</h2>
      <p
        class="text-3xl font-bold"
        :class="weekDelta >= 0 ? 'text-green-500' : 'text-red-500'"
      >
        {{ formatDelta(weekDelta) }}
      </p>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {{ weekDelta >= 0 ? 'En avance sur le planning' : 'En retard sur le planning' }}
      </p>
    </div>

    <!-- Quick action -->
    <router-link
      to="/pointage"
      class="block w-full bg-indigo-600 hover:bg-indigo-700 text-white text-center font-semibold py-4 rounded-2xl shadow-lg transition-colors"
    >
      Pointer maintenant
    </router-link>
  </div>
</template>
