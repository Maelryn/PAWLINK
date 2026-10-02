"use client";

import { useEffect, useSyncExternalStore } from "react";

/* Theme: "auto" follows the clock in Algeria (dark from 19:00 to 07:00), or the user picks light/dark.
   The inline THEME_SCRIPT applies the class before first paint so there is no flash. */

export type ThemeMode = "auto" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const KEY = "pawlink.theme";
export const NIGHT_START = 19;
export const NIGHT_END = 7;

export const THEME_SCRIPT = `(function(){try{var m=localStorage.getItem('${KEY}')||'auto';var h=new Date().getHours();var d=m==='dark'||(m==='auto'&&(h>=${NIGHT_START}||h<${NIGHT_END}));var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(_){}})();`;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readMode(): ThemeMode {
  try {
    const m = localStorage.getItem(KEY);
    if (m === "light" || m === "dark" || m === "auto") return m;
  } catch {}
  return "auto";
}

export function resolve(mode: ThemeMode, date = new Date()): ResolvedTheme {
  if (mode !== "auto") return mode;
  const h = date.getHours();
  return h >= NIGHT_START || h < NIGHT_END ? "dark" : "light";
}

function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener("storage", l);
  // re-evaluate "auto" every minute so the app turns dark at sunset by itself
  const id = setInterval(l, 60_000);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", l);
    clearInterval(id);
  };
}

export function setThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {}
  emit();
}

export function useTheme() {
  const mode = useSyncExternalStore(subscribe, readMode, () => "auto" as ThemeMode);
  const resolved = useSyncExternalStore(
    subscribe,
    () => resolve(readMode()),
    () => "light" as ResolvedTheme,
  );
  return { mode, resolved, setMode: setThemeMode };
}

/** Keeps the <html> class in sync after mount (the inline script handles first paint). */
export function ThemeSync() {
  const { resolved } = useTheme();
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("dark", resolved === "dark");
    el.style.colorScheme = resolved;
  }, [resolved]);
  return null;
}
