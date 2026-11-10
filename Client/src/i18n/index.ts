import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { ar } from './locales/ar'

export type Language = 'en' | 'ar'

/** Persisted key shared with the pre-paint script in index.html. */
export const LANGUAGE_STORAGE_KEY = 'revivehr-lang'

export interface LanguageOption {
  code: Language
  /** Label shown in the switcher while the UI is in English. */
  label: string
  /** Label shown while the UI is in Arabic. */
  nativeLabel: string
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية' },
]

export function isRtl(language: Language): boolean {
  return language === 'ar'
}

export function readStoredLanguage(): Language {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ar' ? 'ar' : 'en'
  } catch {
    // Private mode / blocked storage — fall back to English.
    return 'en'
  }
}

/** Applies `lang` + `dir` on <html>; RTL then flips the whole layout. */
export function applyLanguageToDocument(language: Language) {
  const root = document.documentElement
  root.lang = language
  root.dir = isRtl(language) ? 'rtl' : 'ltr'
}

const initialLanguage: Language = typeof window === 'undefined' ? 'en' : readStoredLanguage()

/**
 * Resolves once the bundled resources are in place. `main.tsx` waits for it so
 * the very first render already has the right language.
 */
export const i18nReady = i18n.use(initReactI18next).init({
  resources: {
    // English is the source language: the keys are the English copy, so a
    // missing Arabic entry simply renders the English text.
    en: { translation: {} },
    ar: { translation: ar },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  supportedLngs: ['en', 'ar'],
  // Copy is used as the key, so '.' and ':' must not split keys/namespaces.
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnNull: false,
})

applyLanguageToDocument(initialLanguage)

export function setLanguage(language: Language) {
  applyLanguageToDocument(language)
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // Persisting is best-effort; the in-memory language still applies.
  }
  void i18n.changeLanguage(language)
}

/** For non-React modules (API clients, hooks) that need a one-off translation. */
export const translate = i18n.t.bind(i18n)

export default i18n
