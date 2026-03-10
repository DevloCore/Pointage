/**
 * Constantes de l'application
 */

/**
 * Durées des toasts en millisecondes
 */
export const TOAST_DURATION = {
  SUCCESS: 3000,
  ERROR: 5000,
  WARNING: 6000,
  INFO: 4000,
  LONG_ERROR: 7000,
  CRITICAL_ERROR: 8000
}

/**
 * Valeurs par défaut des paramètres
 */
export const DEFAULT_SETTINGS = {
  WEEKLY_HOURS: 35,
  WORK_DAYS: [1, 2, 3, 4, 5], // Lundi à vendredi
  MORNING_START_TIME: '09:00',
  DAILY_HOURS: 7 // Calculé: 35 / 5
}

/**
 * Intervalles de rafraîchissement en millisecondes
 */
export const REFRESH_INTERVALS = {
  TIMER: 10000, // 10 secondes
  SYNC: 60000 // 1 minute
}

/**
 * Événements personnalisés
 */
export const CUSTOM_EVENTS = {
  POINTAGE_UPDATED: 'pointage-updated',
  SETTING_UPDATED: 'setting-updated'
}

/**
 * Clés des paramètres dans la DB
 */
export const SETTING_KEYS = {
  WEEKLY_HOURS: 'weeklyHours',
  WORK_DAYS: 'workDays',
  MORNING_START_TIME: 'morningStartTime',
  THEME: 'theme'
}

/**
 * Types de pointages
 */
export const POINTAGE_TYPE = {
  CLOCK_IN: 'in',
  CLOCK_OUT: 'out'
}
