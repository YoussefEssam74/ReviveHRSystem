import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { isRtl, setLanguage, type Language } from './index'

/**
 * Language state for components. `useTranslation` already subscribes to
 * i18next's language events, so consumers re-render on every switch.
 */
export function useLanguage() {
  const { i18n } = useTranslation()
  const language: Language = i18n.resolvedLanguage === 'ar' ? 'ar' : 'en'

  const changeLanguage = useCallback((next: Language) => setLanguage(next), [])
  const toggleLanguage = useCallback(() => setLanguage(language === 'ar' ? 'en' : 'ar'), [language])

  return { language, isRtl: isRtl(language), setLanguage: changeLanguage, toggleLanguage }
}
