"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { Button } from "@/components/ui/Button";
import { Emoji3D } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import { inAlgeria } from "@/lib/trust";
import type { GeoPoint } from "@/lib/types";

/* Location gate: actions that create content (report, post, sign up) need a real position in Algeria.
   The backend must re-check (IP country + the GPS sent with the request). */

type Status = "checking" | "ok" | "denied" | "outside";
const DEMO_POS: GeoPoint = { lat: 36.6455, lng: 4.1979 }; // Larbaâ Nath Irathen

const GeoContext = createContext<GeoPoint | null>(null);
const DemoContext = createContext(false);
/** Device position, available inside <GeoGate>. */
export const useDevicePosition = () => useContext(GeoContext);
/** True when the position is the demo one (jury / testers without location): content made with it is never "verified". */
export const useDemoPosition = () => useContext(DemoContext);

export function GeoGate({ children, bare }: { children: React.ReactNode; bare?: boolean }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>("checking");
  const [pos, setPos] = useState<GeoPoint | null>(null);
  const [demo, setDemo] = useState(false);

  const locate = useCallback(() => {
    if (!navigator.geolocation) return setStatus("denied");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(here);
        setStatus(inAlgeria(here) ? "ok" : "outside");
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  const check = () => {
    setStatus("checking");
    locate();
  };

  useEffect(() => {
    const id = setTimeout(locate, 0);
    return () => clearTimeout(id);
  }, [locate]);

  if (status === "ok" && pos)
    return (
      <GeoContext.Provider value={pos}>
        <DemoContext.Provider value={demo}>{children}</DemoContext.Provider>
      </GeoContext.Provider>
    );

  const blocked = status === "denied" || status === "outside";
  return (
    <div className="min-h-[100svh]">
      {!bare && <TopNav />}
      <div className="mx-auto flex min-h-[80svh] max-w-[440px] flex-col items-center justify-center px-6 pt-20 text-center">
        <Emoji3D src={status === "outside" ? "/3d/globe.png" : "/3d/pin.png"} size={96} className={status === "checking" ? "animate-bounce" : ""} />
        {status === "checking" ? (
          <p className="mt-6 text-[17px] font-semibold text-label-2">{t.geo.checking}</p>
        ) : (
          <>
            <h1 className="mt-6 text-[26px] font-extrabold">{status === "outside" ? t.geo.outsideTitle : t.geo.deniedTitle}</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-label-2">{status === "outside" ? t.geo.outside : t.geo.denied}</p>
            <Button size="lg" className="mt-6" onClick={check}>{t.geo.retry}</Button>
          </>
        )}
        {/* Lets judges and testers without location try the flow. Anything made this way is labelled
            "not on site" by the trust checks, so it can't pass as a verified report. */}
        {blocked && (
          <div className="mt-6 w-full rounded-[22px] bg-surface p-4 text-start shadow-[var(--card-shadow)]">
            <div className="text-[14px] font-semibold">{t.geo.demoTitle}</div>
            <p className="mt-0.5 text-[13px] leading-snug text-label-2">{t.geo.demoBody}</p>
            <Button variant="tinted" size="sm" className="mt-3" onClick={() => { setPos(DEMO_POS); setDemo(true); setStatus("ok"); }}>
              {t.geo.demo}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
