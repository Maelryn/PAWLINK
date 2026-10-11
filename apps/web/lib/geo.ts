"use client";

import type { GeoPoint } from "./types";

/** The device position, or null when it's refused, unavailable or takes too long.
    Browsers only start their own timeout once the permission prompt is answered, so a prompt the
    person ignores would hang forever: this always settles after `timeoutMs`. */
export function getPosition(timeoutMs = 8000, highAccuracy = false): Promise<GeoPoint | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    let done = false;
    const finish = (p: GeoPoint | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(p);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => finish({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => finish(null),
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: 120_000 },
    );
  });
}
