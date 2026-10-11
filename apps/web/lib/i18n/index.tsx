"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import en, { type Dict } from "./en";
import fr from "./fr";
import ar from "./ar";

export type Locale = "fr" | "en" | "ar";
export const DICTS: Record<Locale, Dict> = { fr, en, ar };
export const LOCALES: Locale[] = ["fr", "ar", "en"];

const STORAGE_KEY = "pawlink.locale";
const DEFAULT: Locale = "fr";

/* Locale lives in localStorage; useSyncExternalStore keeps SSR ("fr") and the client in sync. */
const listeners = new Set<() => void>();
/** First visit: follow the browser language (Arabic, French, otherwise English). After that, the choice made in Settings. */
function browserLocale(): Locale {
  for (const l of navigator.languages ?? [navigator.language]) {
    const code = l.toLowerCase().slice(0, 2);
    if (code === "ar" || code === "fr" || code === "en") return code;
  }
  return "en";
}
function readLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in DICTS) return saved as Locale;
    return browserLocale();
  } catch {}
  return DEFAULT;
}
function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", l);
  };
}

interface I18nValue {
  locale: Locale;
  t: Dict;
  dir: "ltr" | "rtl";
  setLocale: (l: Locale) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, readLocale, () => DEFAULT);

  useEffect(() => {
    const el = document.documentElement;
    el.lang = locale;
    el.dir = DICTS[locale].meta.dir;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
    listeners.forEach((fn) => fn());
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ locale, t: DICTS[locale], dir: DICTS[locale].meta.dir, setLocale }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
