"use client";

import { useSyncExternalStore } from "react";

import { useEffect } from "react";

/* Tiny UI state shared across components: the phone tab bar slides away while a map sheet is open.
   It's a counter, not a boolean: when one sheet closes while another opens (list → animal), the
   closing one must not bring the bar back. */
let hideRequests = 0;
let tabBarHidden = false;
const listeners = new Set<() => void>();

function changeHide(delta: number) {
  hideRequests = Math.max(0, hideRequests + delta);
  const next = hideRequests > 0;
  if (next === tabBarHidden) return;
  tabBarHidden = next;
  listeners.forEach((l) => l());
}

/** Keeps the phone tab bar hidden while `active` is true and this component is mounted. */
export function useHideTabBar(active = true) {
  useEffect(() => {
    if (!active) return;
    changeHide(1);
    return () => changeHide(-1);
  }, [active]);
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
let paywallTier: "pro" | "plus" | null = null;
const pwListeners = new Set<() => void>();
export function openPaywall(v = true, tier: "pro" | "plus" | null = null) {
  paywallOpen = v;
  if (v) paywallTier = tier;
  pwListeners.forEach((l) => l());
}
/** The plan the paywall should show first (set by openPaywall). */
export const paywallStartTier = () => paywallTier;
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
