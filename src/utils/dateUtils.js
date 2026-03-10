/**
 * Utilitaires pour la manipulation des dates
 */

/**
 * Obtient le lundi de la semaine d'une date donnée
 * @param {Date} date - Date de référence
 * @returns {Date} Le lundi de la semaine
 */
export function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

/**
 * Formate une date au format YYYY-MM-DD
 * @param {Date} date - Date à formater
 * @returns {string} Date formatée
 */
export function formatDate(date) {
  return date.toISOString().split('T')[0]
}

/**
 * Formate un timestamp en heure au format HH:MM
 * @param {number} timestamp - Timestamp en millisecondes
 * @returns {string} Heure formatée
 */
export function formatTime(timestamp) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Formate une date en label lisible (jour, date mois)
 * @param {string} dateStr - Date au format YYYY-MM-DD
 * @returns {string} Label formaté
 */
export function formatDateLabel(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

/**
 * Formate une durée en millisecondes en heures et minutes
 * @param {number} ms - Durée en millisecondes
 * @returns {string} Durée formatée (ex: "8h 30min")
 */
export function formatDuration(ms) {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return `${hours}h ${String(minutes).padStart(2, '0')}min`
}

/**
 * Formate un delta de temps avec signe
 * @param {number} ms - Delta en millisecondes
 * @returns {string} Delta formaté (ex: "+2h 15min" ou "-1h 30min")
 */
export function formatDelta(ms) {
  const absMs = Math.abs(ms)
  const hours = Math.floor(absMs / 3600000)
  const minutes = Math.floor((absMs % 3600000) / 60000)
  const sign = ms >= 0 ? '+' : '-'
  return `${sign}${hours}h ${String(minutes).padStart(2, '0')}min`
}

/**
 * Génère un tableau de dates pour une semaine
 * @param {Date} monday - Lundi de la semaine
 * @returns {string[]} Tableau de dates au format YYYY-MM-DD
 */
export function getWeekDates(monday) {
  const dates = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday)
    date.setDate(date.getDate() + i)
    dates.push(formatDate(date))
  }
  return dates
}

/**
 * Constantes de temps
 */
export const TIME_CONSTANTS = {
  MS_PER_SECOND: 1000,
  MS_PER_MINUTE: 60000,
  MS_PER_HOUR: 3600000,
  MS_PER_DAY: 86400000
}
