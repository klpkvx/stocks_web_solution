import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { setFormatLocale } from "@/lib/format";
import { KNOWN_NAMESPACES, LOCALE_MESSAGES } from "@/locales/catalog";

export type Locale = "en" | "ru";

type I18nContextValue = {
  locale: Locale;
  ready: boolean;
  setLocale: (locale: Locale) => void;
  loadNamespace: (namespace: string) => Promise<void>;
  t: (
    key: string,
    fallback?: string,
    params?: Record<string, string | number>
  ) => string;
};

const STORAGE_KEY = "ui-locale";

const messages: Record<Locale, Record<string, string>> = {
  en: { ...LOCALE_MESSAGES.en },
  ru: { ...LOCALE_MESSAGES.ru }
};

const KNOWN_NAMESPACE_SET = new Set<string>(KNOWN_NAMESPACES as readonly string[]);

const I18nContext = createContext<I18nContextValue | null>(null);

function isLocale(value: string | null): value is Locale {
  return value === "en" || value === "ru";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    let resolved: Locale = "en";
    if (isLocale(saved)) {
      resolved = saved;
    } else {
      resolved = window.navigator.language.toLowerCase().startsWith("ru")
        ? "ru"
        : "en";
    }
    setLocale(resolved);
    document.documentElement.lang = resolved;
    setFormatLocale(resolved);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, locale);
    }
    document.documentElement.lang = locale;
    setFormatLocale(locale);
  }, [locale, ready]);

  const loadNamespace = useCallback(async (namespace: string) => {
    const safe = String(namespace || "").trim();
    if (!safe) return;
    if (!KNOWN_NAMESPACE_SET.has(safe)) return;
    // Dictionaries are preloaded from namespace JSON chunks for deterministic SSR/CSR output.
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      ready,
      setLocale,
      loadNamespace,
      t: (
        key: string,
        fallback?: string,
        params?: Record<string, string | number>
      ) => {
        const template =
          messages[locale]?.[key] || messages.en[key] || fallback || key;
        if (!params) return template;
        return Object.entries(params).reduce((acc, [paramKey, value]) => {
          const token = `{${paramKey}}`;
          return acc.replaceAll(token, String(value));
        }, template);
      }
    }),
    [loadNamespace, locale, ready]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18nNamespace(namespace: string) {
  const { loadNamespace, locale } = useI18n();

  useEffect(() => {
    void loadNamespace(namespace);
  }, [loadNamespace, locale, namespace]);
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
