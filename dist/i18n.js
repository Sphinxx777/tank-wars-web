import { translations } from './translations.js';

export const LANGUAGE_STORAGE_KEY = 'tank-wars-language';
export const SUPPORTED_LANGUAGES = ['en', 'ru'];
let language = 'en';
let initialized = false;

/** Translate a UI string without interpreting it as HTML. Safe to import in Node. */
export function translate(key, locale = 'en', parameters = {}) {
  const text = translations[locale]?.[key] ?? translations.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => String(parameters[name] ?? match));
}

export function t(key, parameters = {}) {
  return translate(key, language, parameters);
}

export function getLanguage() {
  return language;
}

export function readStoredLanguage(storage) {
  try {
    const saved = storage.getItem(LANGUAGE_STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(saved) ? saved : 'en';
  } catch {
    // Private browsing and blocked storage must not prevent the game loading.
    return 'en';
  }
}

export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  for (const [selector, attribute, dataKey] of [
    ['[data-i18n-aria]', 'aria-label', 'i18nAria'],
    ['[data-i18n-content]', 'content', 'i18nContent'],
  ]) {
    root.querySelectorAll(selector).forEach((element) => {
      element.setAttribute(attribute, t(element.dataset[dataKey]));
    });
  }
  root.querySelectorAll('[data-language]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.language === language));
  });
  document.documentElement.lang = language;
}

export function setLanguage(nextLanguage) {
  if (!SUPPORTED_LANGUAGES.includes(nextLanguage)) return;
  language = nextLanguage;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The selection still applies for this page when persistence is unavailable.
  }
  applyTranslations();
  window.dispatchEvent(new CustomEvent('languagechange', { detail: { language } }));
}

export function initLanguage() {
  if (initialized) return;
  initialized = true;
  try {
    language = readStoredLanguage(localStorage);
  } catch {
    language = 'en';
  }
  applyTranslations();
  document.querySelectorAll('[data-language]').forEach((button) => {
    button.addEventListener('click', () => setLanguage(button.dataset.language));
  });
  window.addEventListener('storage', (event) => {
    if (event.key === LANGUAGE_STORAGE_KEY) {
      language = SUPPORTED_LANGUAGES.includes(event.newValue) ? event.newValue : 'en';
      applyTranslations();
      window.dispatchEvent(new CustomEvent('languagechange', { detail: { language } }));
    }
  });
}
