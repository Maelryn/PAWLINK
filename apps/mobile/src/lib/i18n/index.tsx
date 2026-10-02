"use client";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en, { type Dict } from "./en";
import fr from "./fr";
import ar from "./ar";

export type Locale = "fr" | "en" | "ar";
export const DICTS: Record<Locale, Dict> = { fr, en, ar };
export const LOCALES: Locale[] = ["fr", "ar", "en"];

const STORAGE_KEY = "pawlink.locale";
const DEFAULT: Locale = "fr";

interface I18nValue {
  locale: Locale;
  t: Dict;
  dir: "ltr" | "rtl";
  setLocale: (l: Locale) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && saved in DICTS) setLocaleState(saved as Locale);
    });
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
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
