<script setup>
import { ref, onMounted, watch } from 'vue'
import { getSetting, setSetting } from '../db'
import { useTheme } from '../composables/useTheme'
import { ComputerDesktopIcon, SunIcon, MoonIcon } from '@heroicons/vue/24/outline'

const { theme } = useTheme()
const weeklyHours = ref(35)
const workDays = ref([1, 2, 3, 4, 5])
const morningStartTime = ref('09:00')

const dayLabels = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sam' },
  { value: 0, label: 'Dim' }
]

onMounted(async () => {
  weeklyHours.value = await getSetting('weeklyHours', 35)
  workDays.value = await getSetting('workDays', [1, 2, 3, 4, 5])
  morningStartTime.value = await getSetting('morningStartTime', '09:00')
})

watch(weeklyHours, async (val) => {
  const num = Number(val)
  if (!isNaN(num) && num >= 0) {
    await setSetting('weeklyHours', num)
  }
})

watch(morningStartTime, async (val) => {
  if (val) {
    await setSetting('morningStartTime', val)
  }
})

function toggleDay(day) {
  const idx = workDays.value.indexOf(day)
  if (idx >= 0) {
    workDays.value = workDays.value.filter(d => d !== day)
  } else {
    workDays.value = [...workDays.value, day]
  }
  setSetting('workDays', workDays.value)
}

const themeOptions = [
  { value: 'system', label: 'Système', icon: ComputerDesktopIcon },
  { value: 'light', label: 'Clair', icon: SunIcon },
  { value: 'dark', label: 'Sombre', icon: MoonIcon }
]
</script>

<template>
  <div class="max-w-lg mx-auto px-4 pt-6">
    <h1 class="text-2xl font-bold mb-6">Paramètres</h1>

    <!-- Theme -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 mb-4">
      <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Thème</h2>
      <div class="flex gap-2">
        <button
          v-for="opt in themeOptions"
          :key="opt.value"
          @click="theme = opt.value"
          class="flex-1 py-3 px-3 rounded-xl text-sm font-medium transition-all duration-200"
          :class="theme === opt.value
            ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'"
        >
          <component :is="opt.icon" class="w-6 h-6 mx-auto mb-1" />
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- Morning start time -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 mb-4">
      <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Heure de début habituelle</h2>
      <div class="flex items-center gap-4">
        <label
          for="morning-start-time"
          class="text-sm font-medium text-gray-700 dark:text-gray-300 sr-only"
        >Heure de début habituelle</label>
        <input
          id="morning-start-time"
          v-model="morningStartTime"
          type="time"
          aria-label="Heure de début habituelle"
          class="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
        />
      </div>
      <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">
        Heure habituelle de votre première arrivée le matin. Par défaut : 09:00.
      </p>
    </div>

    <!-- Weekly hours -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 mb-4">
      <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Contrat horaire</h2>
      <div class="flex items-center gap-4">
        <input
          v-model.number="weeklyHours"
          type="number"
          min="0"
          max="80"
          step="0.5"
          class="w-24 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <span class="text-gray-500 dark:text-gray-400">heures / semaine</span>
      </div>
      <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">
        Définissez votre taux horaire contractuel. Par défaut : 35h.
      </p>
    </div>

    <!-- Work days -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 mb-4">
      <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Jours travaillés</h2>
      <div class="flex gap-2">
        <button
          v-for="day in dayLabels"
          :key="day.value"
          @click="toggleDay(day.value)"
          class="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
          :class="workDays.includes(day.value)
            ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'"
        >
          {{ day.label }}
        </button>
      </div>
      <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">
        Sélectionnez les jours où vous travaillez pour le calcul du delta.
      </p>
    </div>

    <!-- About -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5">
      <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">À propos</h2>
      <p class="text-sm text-gray-600 dark:text-gray-300">
        Pointage v1.0.0 — Application de suivi du temps de travail.
      </p>
    </div>
  </div>
</template>
