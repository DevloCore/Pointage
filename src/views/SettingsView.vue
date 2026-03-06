<script setup>
import { ref, onMounted, watch } from 'vue'
import { getSetting, setSetting } from '../db'
import { useTheme } from '../composables/useTheme'

const { theme } = useTheme()
const weeklyHours = ref(35)

onMounted(async () => {
  weeklyHours.value = await getSetting('weeklyHours', 35)
})

watch(weeklyHours, async (val) => {
  const num = Number(val)
  if (!isNaN(num) && num >= 0) {
    await setSetting('weeklyHours', num)
  }
})

const themeOptions = [
  { value: 'system', label: 'Système', icon: '💻' },
  { value: 'light', label: 'Clair', icon: '☀️' },
  { value: 'dark', label: 'Sombre', icon: '🌙' }
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
          <span class="text-lg block mb-1">{{ opt.icon }}</span>
          {{ opt.label }}
        </button>
      </div>
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

    <!-- About -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5">
      <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">À propos</h2>
      <p class="text-sm text-gray-600 dark:text-gray-300">
        Pointage v1.0.0 — Application de suivi du temps de travail.
      </p>
    </div>
  </div>
</template>
