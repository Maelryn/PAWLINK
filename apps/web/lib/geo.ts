"use client";

import type { GeoPoint } from "./types";

let last: { p: GeoPoint; at: number } | null = null;
const FRESH = 2 * 60_000;

/** "granted" | "prompt" | "denied", or "unknown" when the browser can't tell (old Safari). */
export async function geoPermission(): Promise<PermissionState | "unknown"> {
  try {
    return (await navigator.permissions.query({ name: "geolocation" })).state;
  } catch {
    return "unknown";
  }
}

function once(highAccuracy: boolean, timeoutMs: number, waitMs: number): Promise<GeoPoint | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (p: GeoPoint | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(p);
    };
    // safety net: a permission prompt the person ignores would otherwise hang forever
    const timer = setTimeout(() => finish(null), waitMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => finish({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => finish(null),
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: FRESH },
    );
  });
}

/** The device position, or null when it's refused or unavailable.
    - a position from the last 2 minutes is reused (instant, no second prompt)
    - while the permission prompt is open we wait for the answer (the browser timeout only starts after it)
    - a precise fix that takes too long falls back to the quick network position */
export async function getPosition(timeoutMs = 8000, highAccuracy = false): Promise<GeoPoint | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation || (typeof window !== "undefined" && !window.isSecureContext)) return null;
  if (last && Date.now() - last.at < FRESH) return last.p;
  const perm = await geoPermission();
  if (perm === "denied") return null;
  const wait = perm === "granted" ? timeoutMs + 1500 : 60_000;
  let p = await once(highAccuracy, timeoutMs, wait);
  if (!p && highAccuracy && (await geoPermission()) !== "denied") p = await once(false, 8000, 9500);
  if (p) last = { p, at: Date.now() };
  return p;
}
