"use client";

import dynamic from "next/dynamic";

/** MapLibre touches `window` on import, so the map is client-only. */
export const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="shimmer h-full w-full opacity-60" />,
});
export { ALGERIA_VIEW } from "./mapStyle";
