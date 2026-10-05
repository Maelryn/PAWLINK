"use client";

import { useSyncExternalStore } from "react";

/* Tiny UI state shared across components: the phone tab bar slides away when a map sheet is open. */
let tabBarHidden = false;
const listeners = new Set<() => void>();

export function setTabBarHidden(v: boolean) {
  if (tabBarHidden === v) return;
  tabBarHidden = v;
  listeners.forEach((l) => l());
}

export function useTabBarHidden() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => tabBarHidden,
    () => false,
  );
}

/* Paywall (PawLink Pro) opened as a sheet from anywhere: openPaywall() */
let paywallOpen = false;
const pwListeners = new Set<() => void>();
export function openPaywall(v = true) {
  paywallOpen = v;
  pwListeners.forEach((l) => l());
}
export function usePaywallOpen() {
  return useSyncExternalStore(
    (l) => {
      pwListeners.add(l);
      return () => pwListeners.delete(l);
    },
    () => paywallOpen,
    () => false,
  );
}
