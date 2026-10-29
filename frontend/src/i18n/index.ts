import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import tr from './locales/tr';
import en from './locales/en';

export const resources = {
  tr: { translation: tr },
  en: { translation: en },
} as const;

export type AppLanguage = keyof typeof resources;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'tr',
  fallbackLng: 'tr',
  interpolation: { escapeValue: false },
});

export default i18n;
