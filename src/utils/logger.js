/**
 * Système de logging centralisé
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
}

// Configuration: en production, mettre à ERROR ou NONE
const CURRENT_LEVEL = import.meta.env.PROD ? LOG_LEVELS.ERROR : LOG_LEVELS.DEBUG

/**
 * Logger centralisé avec niveaux et préfixes
 */
class Logger {
  constructor(prefix = '') {
    this.prefix = prefix
  }

  /**
   * Crée un sous-logger avec un préfixe spécifique
   * @param {string} subPrefix 
   * @returns {Logger}
   */
  child(subPrefix) {
    const newPrefix = this.prefix ? `${this.prefix}:${subPrefix}` : subPrefix
    return new Logger(newPrefix)
  }

  _log(level, emoji, ...args) {
    if (CURRENT_LEVEL > level) return
    
    const prefix = this.prefix ? `[${this.prefix}]` : ''
    console.log(`${emoji} ${prefix}`, ...args)
  }

  debug(...args) {
    this._log(LOG_LEVELS.DEBUG, '🔍', ...args)
  }

  info(...args) {
    this._log(LOG_LEVELS.INFO, 'ℹ️', ...args)
  }

  success(...args) {
    this._log(LOG_LEVELS.INFO, '✅', ...args)
  }

  warn(...args) {
    if (CURRENT_LEVEL > LOG_LEVELS.WARN) return
    const prefix = this.prefix ? `[${this.prefix}]` : ''
    console.warn(`⚠️ ${prefix}`, ...args)
  }

  error(...args) {
    if (CURRENT_LEVEL > LOG_LEVELS.ERROR) return
    const prefix = this.prefix ? `[${this.prefix}]` : ''
    console.error(`❌ ${prefix}`, ...args)
  }

  // Méthodes spécifiques au domaine
  sync(...args) {
    this._log(LOG_LEVELS.INFO, '🔄', ...args)
  }

  cloud(...args) {
    this._log(LOG_LEVELS.INFO, '☁️', ...args)
  }

  realtime(...args) {
    this._log(LOG_LEVELS.INFO, '📡', ...args)
  }

  database(...args) {
    this._log(LOG_LEVELS.DEBUG, '💾', ...args)
  }

  delete(...args) {
    this._log(LOG_LEVELS.INFO, '🗑️', ...args)
  }
}

// Loggers par module
export const logger = new Logger()
export const dbLogger = logger.child('DB')
export const supabaseLogger = logger.child('SUPABASE')
export const realtimeLogger = logger.child('REALTIME')
export const syncLogger = logger.child('SYNC')
