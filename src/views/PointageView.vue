<script setup>
import { ref } from 'vue'
import { db } from '../db'
import { ClockIcon, CheckCircleIcon } from '@heroicons/vue/24/outline'

const step = ref('initial') // 'initial' | 'timePicker' | 'success'
const pressing = ref(false)

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
        <div class="pointage-btn-wrapper">
          <div class="pointage-btn-ring" />
          <div class="pointage-btn-ring pointage-btn-ring-2" />
          <button
            @click="onFirstClick"
            @pointerdown="pressing = true"
            @pointerup="pressing = false"
            @pointerleave="pressing = false"
            class="pointage-btn"
            :class="{ 'pointage-btn-pressed': pressing }"
          >
            <ClockIcon class="w-12 h-12 mb-2" />
            <span class="text-lg font-bold tracking-wide">Pointer</span>
          </button>
        </div>
        <p class="text-gray-500 dark:text-gray-400 mt-6 text-sm">Appuyez pour enregistrer votre pointage</p>
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
          class="w-36 h-36 rounded-full bg-gradient-to-br from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 active:scale-95 text-white text-lg font-bold shadow-xl shadow-green-500/25 hover:shadow-2xl hover:shadow-green-500/40 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-green-300 dark:focus:ring-green-800 mb-4"
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
          <CheckCircleIcon class="w-24 h-24 text-green-500 success-icon" />
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

.pointage-btn-wrapper {
  position: relative;
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pointage-btn-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 3px solid rgba(99, 102, 241, 0.2);
  animation: pulse-ring 2.5s ease-out infinite;
}

.pointage-btn-ring-2 {
  animation-delay: 1.25s;
}

@keyframes pulse-ring {
  0% {
    transform: scale(0.85);
    opacity: 1;
  }
  100% {
    transform: scale(1.2);
    opacity: 0;
  }
}

.pointage-btn {
  position: relative;
  z-index: 1;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  cursor: pointer;
  border: none;
  background: linear-gradient(135deg, #818cf8, #6366f1, #4f46e5);
  box-shadow:
    0 8px 32px rgba(99, 102, 241, 0.35),
    0 0 0 0 rgba(99, 102, 241, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.pointage-btn:hover {
  transform: scale(1.05);
  box-shadow:
    0 12px 40px rgba(99, 102, 241, 0.45),
    0 0 0 0 rgba(99, 102, 241, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.pointage-btn-pressed {
  transform: scale(0.95) !important;
  box-shadow:
    0 4px 16px rgba(99, 102, 241, 0.3),
    inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.success-icon {
  animation: scaleIn 0.5s ease forwards;
}

@keyframes scaleIn {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
