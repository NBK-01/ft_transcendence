import i18next, { type Resource } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import ar from "./locales/ar";
import en from "./locales/en";
import fr from "./locales/fr";

export const LANGUAGES = ["en", "fr", "ar"] as const;
export type Language = (typeof LANGUAGES)[number];

const RTL_LANGUAGES: ReadonlySet<Language> = new Set(["ar"]);

export const LANGUAGE_STORAGE_KEY = "trans-lang";

export function isLanguage(value: string | undefined): value is Language {
  return LANGUAGES.includes(value as Language);
}

/** "ar-SA" → "ar". The browser can report a region even though only base languages are loaded. */
function baseLanguage(language: string) {
  return language.split("-")[0] ?? language;
}

export function directionOf(language: string): "ltr" | "rtl" {
  const base = baseLanguage(language);
  return isLanguage(base) && RTL_LANGUAGES.has(base) ? "rtl" : "ltr";
}

/** Keep <html lang> and <html dir> in sync so the whole layout mirrors. */
function syncDocument(language: string) {
  const root = document.documentElement;
  root.lang = baseLanguage(language);
  root.dir = directionOf(language);
}

type AppResources = Partial<Record<Language, Record<string, unknown>>>;

/**
 * Initialise i18next once per app. The shared `common` namespace ships with
 * the UI library; each app passes its own strings as the `app` namespace.
 */
export function initI18n(appResources: AppResources = {}) {
  const resources: Resource = {};
  for (const language of LANGUAGES) {
    resources[language] = {
      common: { en, fr, ar }[language],
      app: appResources[language] ?? {},
    };
  }

  i18next.on("languageChanged", syncDocument);

  void i18next
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      supportedLngs: [...LANGUAGES],
      fallbackLng: "en",
      nonExplicitSupportedLngs: true,
      load: "languageOnly",
      ns: ["common", "app"],
      defaultNS: "common",
      interpolation: { escapeValue: false },
      returnObjects: true,
      detection: {
        order: ["localStorage", "navigator"],
        lookupLocalStorage: LANGUAGE_STORAGE_KEY,
        caches: ["localStorage"],
      },
      react: { useSuspense: false },
    });

  return i18next;
}

export { i18next };
export type { CommonResources } from "./locales/en";
