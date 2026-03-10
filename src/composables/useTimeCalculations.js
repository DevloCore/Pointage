/**
 * Composable pour les calculs de temps et progression
 */

import { computed } from 'vue'
import { TIME_CONSTANTS } from '../utils/constants'

/**
 * Calcule le temps de travail total à partir d'une liste de pointages
 * @param {Array} pointages - Liste des pointages
 * @param {number} now - Timestamp actuel
 * @returns {number} Temps de travail en millisecondes
 */
export function computeWorkedTime(pointages, now) {
  const sorted = [...pointages].sort((a, b) => a.timestamp - b.timestamp)
  let total = 0
  
  // Additionner les paires de pointages (entrée/sortie)
  for (let i = 0; i < sorted.length - 1; i += 2) {
    total += sorted[i + 1].timestamp - sorted[i].timestamp
  }
  
  // Si le dernier pointage est une entrée, ajouter le temps jusqu'à maintenant
  if (sorted.length % 2 === 1) {
    total += now - sorted[sorted.length - 1].timestamp
  }
  
  return total
}

/**
 * Hook pour les calculs de temps de travail
 */
export function useTimeCalculations(
  pointages,
  now,
  settings = {}
) {
  const { weeklyHours = 35, workDays = [1, 2, 3, 4, 5], morningStartTime = '09:00' } = settings

  /**
   * Temps de travail total
   */
  const workedTime = computed(() => {
    return computeWorkedTime(pointages.value, now.value)
  })

  /**
   * Durée journalière attendue
   */
  const dailyHours = computed(() => {
    const nbWorkDays = workDays.value?.length || 5
    return weeklyHours.value / nbWorkDays
  })

  /**
   * Progression par rapport à l'objectif
   * @param {number} worked - Temps travaillé en ms
   * @param {number} target - Objectif en heures
   */
  const calculateProgress = (worked, target) => {
    const targetMs = target * TIME_CONSTANTS.MS_PER_HOUR
    if (targetMs === 0) return 0
    return Math.min(100, Math.round((worked / targetMs) * 100))
  }

  /**
   * Progression journalière
   */
  const dayProgress = computed(() => {
    return calculateProgress(workedTime.value, dailyHours.value)
  })

  /**
   * Est-ce que l'utilisateur est actuellement en train de travailler ?
   */
  const isWorking = computed(() => {
    return pointages.value.length % 2 === 1
  })

  /**
   * Dernier pointage
   */
  const lastPointage = computed(() => {
    if (pointages.value.length === 0) return null
    const sorted = [...pointages.value].sort((a, b) => b.timestamp - a.timestamp)
    return sorted[0]
  })

  return {
    workedTime,
    dailyHours,
    dayProgress,
    isWorking,
    lastPointage,
    calculateProgress,
    computeWorkedTime
  }
}

/**
 * Calcule le delta hebdomadaire de temps de travail
 * Prend en compte uniquement les jours où l'utilisateur a travaillé
 * Pour les jours en cours, utilise morningStartTime comme référence
 */
export function calculateWeekDelta(
  weekPointages,
  now,
  weeklyHours,
  workDays,
  morningStartTime
) {
  const nbWorkDays = workDays.length
  if (nbWorkDays === 0) return 0

  const dailyExpectedMs = (weeklyHours / nbWorkDays) * TIME_CONSTANTS.MS_PER_HOUR
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // Parser l'heure de début
  const [startHour = 9, startMin = 0] = morningStartTime.split(':').map(Number)

  let totalDelta = 0

  // Grouper les pointages par date
  const pointagesByDate = weekPointages.reduce((acc, p) => {
    if (!acc[p.date]) acc[p.date] = []
    acc[p.date].push(p)
    return acc
  }, {})

  // Calculer le delta pour chaque jour avec pointages
  Object.entries(pointagesByDate).forEach(([dateStr, dayEntries]) => {
    // Ne compter que jusqu'à aujourd'hui inclus
    if (dateStr > todayStr) return

    const sorted = [...dayEntries].sort((a, b) => a.timestamp - b.timestamp)

    // Calculer le temps de travail effectué (paires complètes)
    let dayWorked = 0
    for (let i = 0; i < sorted.length - 1; i += 2) {
      dayWorked += sorted[i + 1].timestamp - sorted[i].timestamp
    }

    const isToday = dateStr === todayStr
    const isCurrentlyWorking = isToday && sorted.length % 2 === 1

    if (isCurrentlyWorking) {
      // Jour en cours : calculer le temps travaillé en direct
      const liveWorked = dayWorked + (now - sorted[sorted.length - 1].timestamp)
      
      // Calculer le temps théorique attendu depuis morningStartTime
      const morningStartMs = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        startHour,
        startMin
      ).getTime()
      
      // Temps écoulé depuis le début théorique
      let elapsedSinceMorning = Math.max(0, now - morningStartMs)
      
      // Soustraire les pauses (écarts entre sortie et entrée)
      let totalBreakTime = 0
      for (let i = 1; i < sorted.length - 1; i += 2) {
        totalBreakTime += sorted[i + 1].timestamp - sorted[i].timestamp
      }
      
      // Temps théorique = temps écoulé - pauses, plafonné à l'objectif journalier
      const expectedSoFar = Math.max(0, Math.min(dailyExpectedMs, elapsedSinceMorning - totalBreakTime))
      
      totalDelta += liveWorked - expectedSoFar
    } else {
      // Jour terminé : comparer au temps journalier attendu
      totalDelta += dayWorked - dailyExpectedMs
    }
  })

  return totalDelta
}
