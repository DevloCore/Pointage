<script setup>
import { ref } from 'vue'
import { db } from '../db'

const step = ref('initial') // 'initial' | 'timePicker' | 'success'

const now = new Date()
const selectedHour = ref(now.getHours())
const selectedMinute = ref(now.getMinutes())

function onFirstClick() {
  const current = new Date()
  selectedHour.value = current.getHours()
  selectedMinute.value = current.getMinutes()
  step.value = 'timePicker'
}

async function onConfirm() {
  const d = new Date()
  d.setHours(selectedHour.value, selectedMinute.value, 0, 0)

  await db.pointages.add({
    timestamp: d.getTime(),
    date: d.toISOString().split('T')[0]
  })

  step.value = 'success'
  setTimeout(() => {
    step.value = 'initial'
  }, 2500)
}

function onCancel() {
  step.value = 'initial'
}

const hours = Array.from({ length: 24 }, (_, i) => i)
const minutes = Array.from({ length: 60 }, (_, i) => i)
</script>

<template>
  <div class="max-w-lg mx-auto px-4 pt-6 flex flex-col items-center justify-center min-h-[80vh]">

    <!-- Step 1: Initial button -->
    <transition name="fade" mode="out-in">
      <div v-if="step === 'initial'" key="initial" class="flex flex-col items-center">
        <h1 class="text-2xl font-bold mb-8">Pointage</h1>
        <button
          @click="onFirstClick"
          class="w-40 h-40 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xl font-bold shadow-xl hover:shadow-2xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-800"
        >
          Pointer
        </button>
        <p class="text-gray-500 dark:text-gray-400 mt-4 text-sm">Appuyez pour enregistrer votre pointage</p>
      </div>
    </transition>

    <!-- Step 2: Time picker -->
    <transition name="fade" mode="out-in">
      <div v-if="step === 'timePicker'" key="timePicker" class="flex flex-col items-center w-full max-w-xs">
        <h2 class="text-xl font-bold mb-6">Ajuster l'heure</h2>

        <div class="flex items-center gap-4 mb-8">
          <div class="flex flex-col items-center">
            <label class="text-xs text-gray-500 dark:text-gray-400 mb-1">Heures</label>
            <select
              v-model.number="selectedHour"
              class="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-2xl font-mono text-center appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option v-for="h in hours" :key="h" :value="h">{{ String(h).padStart(2, '0') }}</option>
            </select>
          </div>

          <span class="text-3xl font-bold mt-5">:</span>

          <div class="flex flex-col items-center">
            <label class="text-xs text-gray-500 dark:text-gray-400 mb-1">Minutes</label>
            <select
              v-model.number="selectedMinute"
              class="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-2xl font-mono text-center appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option v-for="m in minutes" :key="m" :value="m">{{ String(m).padStart(2, '0') }}</option>
            </select>
          </div>
        </div>

        <button
          @click="onConfirm"
          class="w-36 h-36 rounded-full bg-green-500 hover:bg-green-600 active:scale-95 text-white text-lg font-bold shadow-xl hover:shadow-2xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-green-300 dark:focus:ring-green-800 mb-4"
        >
          Valider
        </button>

        <button
          @click="onCancel"
          class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm transition-colors"
        >
          Annuler
        </button>
      </div>
    </transition>

    <!-- Step 3: Success animation -->
    <transition name="fade" mode="out-in">
      <div v-if="step === 'success'" key="success" class="flex flex-col items-center">
        <div class="success-checkmark mb-6">
          <svg class="w-24 h-24 text-green-500" viewBox="0 0 24 24" fill="none">
            <circle class="circle-anim" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
            <path class="check-anim" d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <p class="text-xl font-bold text-green-500">Pointage enregistré !</p>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">
          {{ String(selectedHour).padStart(2, '0') }}:{{ String(selectedMinute).padStart(2, '0') }}
        </p>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from {
  opacity: 0;
  transform: scale(0.95);
}
.fade-leave-to {
  opacity: 0;
  transform: scale(1.05);
}

.circle-anim {
  stroke-dasharray: 63;
  stroke-dashoffset: 63;
  animation: drawCircle 0.6s ease forwards;
}

.check-anim {
  stroke-dasharray: 20;
  stroke-dashoffset: 20;
  animation: drawCheck 0.4s 0.5s ease forwards;
}

@keyframes drawCircle {
  to { stroke-dashoffset: 0; }
}

@keyframes drawCheck {
  to { stroke-dashoffset: 0; }
}
</style>
