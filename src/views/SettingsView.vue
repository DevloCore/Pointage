<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { getSetting, setSetting } from '../db'
import { configureSupabase, testSupabaseConnection } from '../db/supabase'
import { useTheme } from '../composables/useTheme'
import { useSync } from '../composables/useSync'
import { useToast } from '../composables/useToast'
import { ComputerDesktopIcon, SunIcon, MoonIcon, CloudIcon, ArrowPathIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/vue/24/outline'
import { InformationCircleIcon } from '@heroicons/vue/24/outline'

const { theme } = useTheme()
const { isConfigured, isSyncing, lastSyncDate, syncError, fullSync, syncFromCloud } = useSync()
const { error: showError, success: showSuccess } = useToast()

const weeklyHours = ref(35)
const workDays = ref([1, 2, 3, 4, 5])
const morningStartTime = ref('09:00')
const supabaseUrl = ref('')
const supabaseAnonKey = ref('')
const isSavingSupabaseConfig = ref(false)

const dayLabels = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sam' },
  { value: 0, label: 'Dim' }
]

async function loadSettings() {
  weeklyHours.value = await getSetting('weeklyHours', 35)
  workDays.value = await getSetting('workDays', [1, 2, 3, 4, 5])
  morningStartTime.value = await getSetting('morningStartTime', '09:00')
  supabaseUrl.value = await getSetting('supabaseUrl', '')
}

onMounted(async () => {
  await loadSettings()
  // Écouter les changements en temps réel
  window.addEventListener('setting-updated', loadSettings)
})

onUnmounted(() => {
  window.removeEventListener('setting-updated', loadSettings)
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
  setSetting('workDays', [...workDays.value])
}

async function manualSync() {
  await fullSync()
}

async function saveSupabaseConfig() {
  isSavingSupabaseConfig.value = true

  try {
    const cleanUrl = supabaseUrl.value.trim()
    const cleanAnonKey = supabaseAnonKey.value.trim()

    if (!cleanUrl || !cleanAnonKey) {
      showError('URL et clé Supabase sont obligatoires.')
      return
    }

    const connectionTest = await testSupabaseConnection({
      url: cleanUrl,
      anonKey: cleanAnonKey
    })

    if (!connectionTest.success) {
      showError(`Connexion Supabase impossible: ${connectionTest.error}`)
      return
    }

    const isValid = configureSupabase({
      url: cleanUrl,
      anonKey: cleanAnonKey
    })

    if (!isValid) {
      showError('Configuration Supabase invalide.')
      return
    }

    await setSetting('supabaseUrl', cleanUrl)
    await setSetting('supabaseAnonKey', cleanAnonKey)
    await syncFromCloud()

    showSuccess('Configuration Supabase enregistrée.')
	supabaseAnonKey.value = '' // Effacer la clé du champ après enregistrement
  } finally {
    isSavingSupabaseConfig.value = false
  }
}

function formatRelativeTime(date) {
  if (!date) return ''
  const now = Date.now()
  const diff = now - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (seconds < 60) return 'à l\'instant'
  if (minutes < 60) return `il y a ${minutes} min`
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `il y a ${days}j`
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

    <!-- Synchronization -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 mb-4">
      <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
        <CloudIcon class="w-4 h-4" />
        Synchronisation cloud
      </h2>
      
      <div class="text-sm text-gray-600 dark:text-gray-300">
		<div class="flex gap-2">
			<CheckCircleIcon v-if="isConfigured" class="w-5 h-5 text-green-600 dark:text-green-400" />
			<InformationCircleIcon v-else class="w-5 h-5 text-amber-600 dark:text-amber-400" />
			<span class="mb-3" :class="isConfigured ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'">
			  {{ isConfigured ? 'Synchronisation cloud configurée' : 'Synchronisation cloud non configurée' }}
			</span>
		</div>
        <p v-if="!isConfigured" class="text-xs mb-3 text-amber-600 dark:text-amber-400">
          La configuration Supabase est obligatoire pour utiliser l'application.
        </p>

        <div class="space-y-3">
          <div>
            <label for="supabase-url" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">URL Supabase</label>
            <input
              id="supabase-url"
              v-model.trim="supabaseUrl"
              type="url"
              placeholder="https://xxxxx.supabase.co"
              class="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label for="supabase-key" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Clé anon Supabase</label>
            <input
              id="supabase-key"
              v-model.trim="supabaseAnonKey"
              type="password"
              placeholder="eyJ..."
              class="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            @click="saveSupabaseConfig"
            :disabled="isSavingSupabaseConfig"
            class="w-full py-2.5 rounded-lg text-sm font-medium transition-all"
            :class="isSavingSupabaseConfig
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/70'"
          >
            {{ isSavingSupabaseConfig ? 'Enregistrement...' : 'Enregistrer la configuration' }}
          </button>
        </div>
      </div>

      <div v-if="isConfigured" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <CheckCircleIcon v-if="!syncError" class="w-5 h-5 text-green-500" />
            <XCircleIcon v-else class="w-5 h-5 text-red-500" />
            <span class="text-sm font-medium">
              {{ syncError ? 'Erreur' : 'Syncronisé' }}
            </span>
          </div>
          <button
            @click="manualSync"
            :disabled="isSyncing"
            class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            :class="isSyncing 
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed' 
              : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/70'"
          >
            <ArrowPathIcon class="w-4 h-4" :class="{ 'animate-spin': isSyncing }" />
            {{ isSyncing ? 'Sync...' : 'Synchroniser' }}
          </button>
        </div>
        
        <!-- <p v-if="lastSyncDate" class="text-xs text-gray-500 dark:text-gray-400">
          Dernière sync : {{ formatRelativeTime(lastSyncDate) }}
        </p>
        
        <p v-if="syncError" class="text-xs text-red-500 mt-1">
          {{ syncError }}
        </p>
        
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">
          💡 La synchronisation est automatique lors de chaque modification
        </p> -->
      </div>
    </div>

    <!-- About -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5">
      <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">À propos</h2>
      <p class="text-sm text-gray-600 dark:text-gray-300">
        Application de pointage développée par DevloCore.
      </p>
	  <p>
		<a href="https://devlocore.fr" target="_blank" class="text-indigo-600 dark:text-indigo-400 hover:underline">
		  devlocore.fr
		</a>
	  </p>
    </div>
  </div>
</template>
