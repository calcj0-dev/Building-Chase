import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { useSettingsStore, type Language } from '../store/settingsStore'
import en from './locales/en.json'
import ja from './locales/ja.json'

export const DEFAULT_LANGUAGE: Language = 'ja'

void i18n.use(initReactI18next).init({
  resources: {
    ja: { translation: ja },
    en: { translation: en },
  },
  // 保存された言語設定で起動する
  lng: useSettingsStore.getState().language,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
})

/** 設定の言語を画面と <html lang> に反映する */
function applyLanguage(language: Language) {
  void i18n.changeLanguage(language)
  if (typeof document !== 'undefined') document.documentElement.lang = language
}

applyLanguage(useSettingsStore.getState().language)
useSettingsStore.subscribe((s, prev) => {
  if (s.language !== prev.language) applyLanguage(s.language)
})

export default i18n
