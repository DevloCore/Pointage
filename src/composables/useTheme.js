import { ref, watch, onMounted } from 'vue'
import { getSetting, setSetting } from '../db'

const theme = ref('system')
let initialized = false

function applyTheme(value) {
  const root = document.documentElement
  if (value === 'dark') {
    root.classList.add('dark')
  } else if (value === 'light') {
    root.classList.remove('dark')
  } else {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }
}

export function useTheme() {
  onMounted(async () => {
    if (!initialized) {
      const saved = await getSetting('theme', 'system')
      theme.value = saved
      applyTheme(saved)
      initialized = true

      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (theme.value === 'system') applyTheme('system')
      })
    }
  })

  watch(theme, async (val) => {
    await setSetting('theme', val)
    applyTheme(val)
  })

  return { theme }
}
