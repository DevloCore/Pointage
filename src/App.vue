<script setup>
import { ref, watch } from 'vue'
import { useTheme } from './composables/useTheme'
import { useRoute, useRouter } from 'vue-router'
import ToastContainer from './components/ToastContainer.vue'
import {
  HomeIcon,
  ClockIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon
} from '@heroicons/vue/24/outline'

useTheme()
const route = useRoute()
const router = useRouter()

const navItems = [
  { to: '/', label: 'Accueil', icon: HomeIcon },
//   { to: '/pointage', label: 'Pointage', icon: ClockIcon },
  { to: '/history', label: 'Historique', icon: ClipboardDocumentListIcon },
  { to: '/settings', label: 'Paramètres', icon: Cog6ToothIcon }
]

const navOrder = { '/': 0, '/history': 1, '/settings': 2 }
const transitionName = ref('slide-left')

watch(() => route.path, (to, from) => {
  const toIndex = navOrder[to] ?? 0
  const fromIndex = navOrder[from] ?? 0
  transitionName.value = toIndex >= fromIndex ? 'slide-left' : 'slide-right'
})
</script>

<template>
  <div class="app-shell min-h-dvh bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 pb-20 transition-colors">
    <ToastContainer />
    
    <router-view v-slot="{ Component, route: currentRoute }">
      <transition :name="transitionName" mode="out-in">
        <component :is="Component" :key="currentRoute.path" />
      </transition>
    </router-view>

    <nav class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 safe-area-bottom">
      <div class="flex justify-around items-center h-16 max-w-lg mx-auto">
        <router-link
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex flex-col items-center justify-center w-full h-full text-xs transition-colors"
          :class="route.path === item.to
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
        >
          <component :is="item.icon" class="w-6 h-6 mb-0.5" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </router-link>
      </div>
    </nav>
  </div>
</template>

<style scoped>
.app-shell {
  position: relative;
  overflow-x: clip;
}

nav {
  transform: translateZ(0);
  backface-visibility: hidden;
}

.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
  will-change: opacity, transform;
}

.slide-left-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}
.slide-right-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
