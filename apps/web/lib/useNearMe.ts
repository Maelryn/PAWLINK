"use client";

import { useEffect, useState } from "react";
import { useSession } from "./auth";
import { geoPermission, getPosition } from "./geo";
import { inAlgeria } from "./trust";
import type { GeoPoint } from "./types";

/** Where "near me" is: the device position when location is allowed (found silently), otherwise the
    position saved on the profile. The person can turn it off, or ask for the device position. */
export function useNearMe() {
  const me = useSession();
  const [here, setHere] = useState<GeoPoint | null>(null);
  const [off, setOff] = useState(false);
  const [locating, setLocating] = useState(false);
  useEffect(() => {
    let live = true;
    geoPermission().then((p) => p === "granted" && getPosition(8000).then((h) => live && h && inAlgeria(h) && setHere(h)));
    return () => {
      live = false;
    };
  }, []);
  const locate = async () => {
    setOff(false);
    setLocating(true);
    const h = await getPosition(10000);
    setLocating(false);
    if (h && inAlgeria(h)) {
      setHere(h);
      return true;
    }
    return false;
  };
  const origin = off ? null : (here ?? me?.location ?? null);
  return { origin, locating, locate, clear: () => setOff(true) };
}
