"use client";

import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import { ArrowLeft, ChevronRight, Globe2, Layers, Navigation, Phone, Search, X, Camera, Flame, HandHeart, PawPrint, Tractor } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { AICard } from "@/components/cases/AICard";
import { CaseRow, HelpPicker } from "@/components/cases/CaseBits";
import { TopNav } from "@/components/layout/TopNav";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Avatar, CasePhoto, Chip, Emoji3D, Segmented, Stars, TimeAgo, TriageBadge } from "@/components/ui/primitives";
import { useCaseAI } from "@/lib/ai/useCaseAI";
import { useI18n } from "@/lib/i18n";
import { EMERGENCY_ZONES } from "@/lib/mock/data";
import { LIVESTOCK, SERVICE_EMOJI, SPECIES_EMOJI, TRIAGE_ORDER } from "@/lib/species";
import { isPublic, store, useStore } from "@/lib/store";
import { gmaps } from "@/lib/trust";
import { TrustBadge } from "@/components/cases/Trust";
import type { Case, GeoPoint, Triage } from "@/lib/types";
import { cn, distanceKm, minutesSince } from "@/lib/utils";
import { setTabBarHidden } from "@/lib/ui";
import { ALGERIA_VIEW, MapView } from "./index";

const ZONE = EMERGENCY_ZONES[0];
const ALGIERS: GeoPoint = { lat: 36.7538, lng: 3.0588 };

const PLACES: { name: string; lat: number; lng: number; zoom: number }[] = [
  { name: "Alger", lat: 36.7538, lng: 3.0588, zoom: 11.5 },
  { name: "Tizi Ouzou", lat: 36.7118, lng: 4.0459, zoom: 11 },
  { name: "Larbaâ Nath Irathen", lat: 36.6367, lng: 4.2003, zoom: 12 },
  { name: "Oran", lat: 35.6971, lng: -0.6308, zoom: 11.5 },
  { name: "Constantine", lat: 36.365, lng: 6.6147, zoom: 11.5 },
  { name: "Béjaïa", lat: 36.7509, lng: 5.0567, zoom: 11.5 },
  { name: "Sétif", lat: 36.1911, lng: 5.4137, zoom: 11.5 },
  { name: "Djelfa", lat: 34.6728, lng: 3.2631, zoom: 11 },
  { name: "Ghardaïa", lat: 32.4909, lng: 3.6735, zoom: 11 },
  { name: "Blida", lat: 36.4701, lng: 2.8277, zoom: 11.5 },
];

function useIsDesktop() {
  const [d, setD] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const f = () => setD(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return d;
}

export function MapExperience() {
  const { t } = useI18n();
  const params = useSearchParams();
  const router = useRouter();
  const desktop = useIsDesktop();
  const allCases = useStore((s) => s.cases);
  const lastCreatedId = useStore((s) => s.lastCreatedId);

  const mapRef = useRef<MapRef | null>(null);
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("case"));
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [emergency, setEmergency] = useState(params.get("mode") === "emergency");
  const [triage, setTriage] = useState<"all" | Triage>("all");
  const [category, setCategory] = useState<"all" | "companion" | "livestock">("all");
  const [showServices, setShowServices] = useState(false);
  const [is3d, setIs3d] = useState(false);
  const [userLoc, setUserLoc] = useState<GeoPoint | null>(null);
  const [query, setQuery] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [dropId, setDropId] = useState<string | null>(null);

  const ref = userLoc ?? (emergency ? ZONE.center : ALGIERS);

  const cases = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allCases
      .filter(isPublic)
      .filter((c) => (emergency ? c.emergencyZoneId === ZONE.id : true))
      .filter((c) => triage === "all" || c.triage === triage)
      .filter((c) => category === "all" || (category === "livestock" ? LIVESTOCK.includes(c.species) : !LIVESTOCK.includes(c.species)))
      .filter((c) => !q || c.title.toLowerCase().includes(q) || (c.location.address ?? "").toLowerCase().includes(q))
      .map((c) => ({ c, d: distanceKm(ref, c.location) }))
      .sort((a, b) => (emergency ? TRIAGE_ORDER[a.c.triage] - TRIAGE_ORDER[b.c.triage] || a.d - b.d : a.d - b.d));
  }, [allCases, emergency, triage, category, query, ref]);

  const selected = allCases.find((c) => c.id === selectedId) ?? null;
  const SERVICES = useStore((s) => s.services).filter((s) => s.status === "approved");
  const service = SERVICES.find((s) => s.id === serviceId) ?? null;

  /* ── camera helpers ── */
  const flyToCase = useCallback(
    (c: Case, zoom?: number) => {
      const m = mapRef.current;
      if (!m) return;
      m.flyTo({
        center: [c.location.lng, c.location.lat],
        zoom: Math.max(zoom ?? 12.5, m.getZoom()),
        // phones: keep the pin in the strip between the top bar and the sheet
        offset: desktop ? [200, 40] : [0, -Math.max(140, window.innerHeight / 2 - 200)],
        duration: 1400,
        curve: 1.5,
        essential: true,
      });
    },
    [desktop],
  );

  useEffect(() => {
    if (!ready) return;
    const m = mapRef.current;
    if (!m) return;
    if (emergency) {
      m.flyTo({ center: [ZONE.center.lng, ZONE.center.lat], zoom: desktop ? 11.2 : 10.4, pitch: 55, bearing: -18, offset: desktop ? [180, 30] : [0, 0], duration: 2800, curve: 1.6, essential: true });
      const orbit = () => m.easeTo({ bearing: m.getBearing() + 35, duration: 40000, easing: (x) => x });
      m.once("moveend", orbit);
      return () => {
        m.off("moveend", orbit);
      };
    } else {
      m.flyTo({ ...{ center: (desktop ? [ALGERIA_VIEW.longitude, ALGERIA_VIEW.latitude] : [4.3, 36.1]) as [number, number] }, zoom: desktop ? 5.9 : 5.4, pitch: is3d ? 50 : 0, bearing: 0, offset: desktop ? [200, 0] : [0, 0], duration: 2000, essential: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emergency, ready]);

  const first3d = useRef(true);
  useEffect(() => {
    if (!ready) return;
    if (first3d.current) {
      first3d.current = false; // don't interrupt the opening camera move
      return;
    }
    mapRef.current?.easeTo({ pitch: is3d ? 58 : 0, bearing: is3d ? -20 : 0, duration: 1200 });
  }, [is3d, ready]);

  // A just-reported case drops in on the map.
  useEffect(() => {
    if (!ready || !lastCreatedId) return;
    const c = allCases.find((x) => x.id === lastCreatedId);
    if (!c) return;
    setTimeout(() => {
      setDropId(c.id);
      flyToCase(c, 13);
      setTimeout(() => setSelectedId(c.id), 1500);
    }, 400);
    store.clearLastCreated();
    setTimeout(() => setDropId(null), 4500);
  }, [ready, lastCreatedId, allCases, flyToCase]);

  useEffect(() => {
    if (ready && selected && params.get("case") === selected.id) flyToCase(selected, 13);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const select = (id: string | null) => {
    setSelectedId(id);
    setHelpOpen(false);
    if (id) {
      setServiceId(null);
      const c = allCases.find((x) => x.id === id);
      if (c) flyToCase(c);
    }
  };

  const locate = () => {
    const fallback = () => {
      const p = { lat: 36.7538, lng: 3.0588 };
      setUserLoc(p);
      mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: 12, duration: 1600 });
    };
    if (!navigator.geolocation) return fallback();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLoc(p);
        mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: 12, duration: 1600 });
      },
      fallback,
      { timeout: 5000 },
    );
  };

  const searchSubmit = () => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const place = PLACES.find((p) => p.name.toLowerCase().includes(q));
    if (place) {
      mapRef.current?.flyTo({ center: [place.lng, place.lat], zoom: place.zoom, duration: 1800, offset: desktop ? [200, 0] : [0, 0] });
      setQuery("");
    } else if (cases[0]) select(cases[0].c.id);
  };

  const zoneCases = allCases.filter((c) => c.emergencyZoneId === ZONE.id);
  const zoneUrgent = zoneCases.filter((c) => c.triage === "urgent").length;

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg">
      <TopNav floating />

      <MapView
        cases={cases.map((x) => x.c)}
        services={showServices ? SERVICES : undefined}
        zone={emergency ? ZONE : null}
        selectedId={selectedId}
        selectedServiceId={serviceId}
        onSelectCase={select}
        onSelectService={(id) => {
          setServiceId(id);
          if (id) setSelectedId(null);
        }}
        initialView={desktop ? { zoom: 5.2 } : { longitude: 4.3, latitude: 36.1, zoom: 5.4 }}
        dropInId={dropId}
        userLocation={userLoc}
        onReady={(m) => {
          mapRef.current = m;
          setReady(true);
        }}
      />

      {/* Emergency "dusk" grade over the map */}
      <AnimatePresence>
        {emergency && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              background:
                "radial-gradient(120% 90% at 60% 45%, transparent 35%, rgba(255,80,20,0.22) 100%), linear-gradient(180deg, rgba(255,120,40,0.14), transparent 40%)",
              mixBlendMode: "multiply",
            }}
          />
        )}
      </AnimatePresence>

      {/* Emergency banner */}
      <AnimatePresence>
        {emergency && (
          <motion.div
            initial={{ y: -80, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -60, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.2 }}
            className="absolute left-1/2 top-[124px] z-20 w-[min(560px,calc(100%-24px))] -translate-x-1/2 lg:left-[calc(50%+205px)] lg:top-[84px]"
          >
            <div className="relative overflow-hidden rounded-[26px] p-[1.5px]" style={{ background: "linear-gradient(110deg,#ff2d55,#ff9500,#ff2d55)" }}>
              <div className="glass-strong flex items-center gap-3 rounded-[25px] px-3.5 py-2.5">
                <Emoji3D src="/3d/fire.png" size={36} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-urgent">
                    <span className="relative flex h-2 w-2">
                      <span className="pulse-ring absolute inset-0 rounded-full bg-urgent" />
                      <span className="relative h-2 w-2 rounded-full bg-urgent" />
                    </span>
                    {t.map.zoneActive} · {t.map.since(Math.round(minutesSince(ZONE.startedAt) / 60))}
                  </div>
                  <div className="truncate text-[15px] font-semibold">{ZONE.region}</div>
                </div>
                <div className="hidden items-center gap-3 sm:flex">
                  <Stat n={zoneCases.length} label={t.map.zoneStats.cases} />
                  <Stat n={zoneUrgent} label={t.map.zoneStats.urgent} color="var(--urgent)" />
                  <Stat n={ZONE.stats.helpers} label={t.map.zoneStats.helpers} color="var(--stable)" />
                </div>
                <a href="tel:14" className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-urgent px-3 text-[13px] font-semibold text-white">
                  <Phone className="h-3.5 w-3.5" /> 14
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right control stack (Apple Maps style) */}
      <div className={cn("absolute end-3 z-20 flex flex-col gap-2.5 transition-[top] duration-500 lg:end-4 lg:top-[84px]", emergency ? "top-[200px]" : "top-[128px]")}>
        <div className="glass glass-sheen flex flex-col overflow-hidden rounded-full">
          <ControlBtn label={t.map.showServices} active={showServices} onClick={() => setShowServices((v) => !v)}>
            <Layers className="h-[19px] w-[19px]" />
          </ControlBtn>
          <span className="mx-2.5 h-px bg-separator" />
          <ControlBtn label={t.map.locate} onClick={locate} active={!!userLoc}>
            <Navigation className="h-[18px] w-[18px]" />
          </ControlBtn>
        </div>
        <button
          type="button"
          onClick={() => setIs3d((v) => !v)}
          className={cn("glass glass-sheen flex h-12 w-12 items-center justify-center rounded-full text-[15px] font-bold transition-colors", is3d && "text-accent")}
        >
          {is3d ? t.map.view2d : t.map.view3d}
        </button>
        <button
          type="button"
          aria-label={t.map.allAlgeria}
          onClick={() => {
            setEmergency(false);
            mapRef.current?.flyTo({ center: desktop ? [ALGERIA_VIEW.longitude, ALGERIA_VIEW.latitude] : [4.3, 36.1], zoom: desktop ? 5.9 : 5.4, pitch: 0, bearing: 0, offset: desktop ? [200, 0] : [0, 0], duration: 1800 });
          }}
          className="glass glass-sheen flex h-12 w-12 items-center justify-center rounded-full"
        >
          <Globe2 className="h-[19px] w-[19px]" />
        </button>
      </div>

      {/* Desktop side panel */}
      {desktop && (
        <motion.aside
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 26, delay: 0.2 }}
          className="glass-strong absolute bottom-4 start-4 top-[84px] z-20 flex w-[340px] flex-col overflow-hidden rounded-[30px] xl:w-[370px]"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {selected ? (
              <motion.div
                key={`d-${selected.id}`}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                className="flex h-full flex-col overflow-y-auto overscroll-contain no-scrollbar"
              >
                <CaseQuickView c={selected} onBack={() => select(null)} helpOpen={helpOpen} setHelpOpen={setHelpOpen} distance={distanceKm(ref, selected.location)} />
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                className="flex h-full flex-col"
              >
                <div className="space-y-3 p-4 pb-2">
                  <SearchBox value={query} onChange={setQuery} onSubmit={searchSubmit} />
                  <EmergencyToggle on={emergency} onToggle={() => setEmergency((v) => !v)} count={zoneCases.length} urgent={zoneUrgent} />
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                    <TriageChips value={triage} onChange={setTriage} />
                  </div>
                  <Segmented
                    layoutId="cat-seg"
                    className="w-full [&>button]:flex-1"
                    value={category}
                    onChange={setCategory}
                    options={[
                      { value: "all", label: t.common.all },
                      { value: "companion", label: <><PawPrint className="h-3.5 w-3.5" />{t.common.companion}</> },
                      { value: "livestock", label: <><Tractor className="h-3.5 w-3.5" />{t.common.livestock}</> },
                    ]}
                  />
                </div>
                <div className="flex items-center justify-between px-5 pb-1 pt-2">
                  <span className="text-[17px] font-bold tracking-[-0.02em]">{t.map.nearby}</span>
                  <span className="text-[13px] font-medium text-label-2">{t.map.results(cases.length)}</span>
                </div>
                <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3 no-scrollbar">
                  {cases.map(({ c, d }, i) => (
                    <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }}>
                      <CaseRow c={c} distance={d} onClick={() => select(c.id)} />
                    </motion.div>
                  ))}
                  {cases.length === 0 && <Empty label={t.map.noResults} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.aside>
      )}

      {/* Mobile: chips on top, carousel at the bottom, sheet for details */}
      {!desktop && (
        <>
          <div className="absolute inset-x-0 top-[72px] z-20 flex gap-2 overflow-x-auto px-3 py-1 pe-20 no-scrollbar">
            <Chip active={emergency} color="#ff3b30" onClick={() => setEmergency((v) => !v)}>
              <Flame className="h-4 w-4" /> {t.map.emergency}
            </Chip>
            <TriageChips value={triage} onChange={setTriage} />
          </div>
          <AnimatePresence>
            {!selected && (
              <MobileListSheet items={cases} onOpen={(c) => select(c.id)} />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {selected && (
              <BottomSheet onClose={() => select(null)} key={selected.id}>
                <CaseQuickView c={selected} onBack={() => select(null)} helpOpen={helpOpen} setHelpOpen={setHelpOpen} distance={distanceKm(ref, selected.location)} sheet />
              </BottomSheet>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Service card */}
      <AnimatePresence>
        {service && (
          <motion.div
            key={service.id}
            initial={{ y: 40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="glass-strong absolute bottom-[96px] left-1/2 z-30 w-[min(380px,calc(100%-24px))] -translate-x-1/2 rounded-[28px] p-4 lg:bottom-6 lg:left-[calc(50%+205px)]"
          >
            <div className="flex items-start gap-3">
              <Emoji3D src={SERVICE_EMOJI[service.type]} size={44} />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold uppercase tracking-wide text-label-2">{t.common.service[service.type]}</div>
                <div className="truncate text-[17px] font-bold">{service.name}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-label-2">
                  <Stars value={service.rating} /> {service.rating} · {t.services.reviews(service.reviewCount)}
                </div>
              </div>
              <button type="button" onClick={() => setServiceId(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              {service.phone && (
                <ButtonLink href={`tel:${service.phone.replace(/\s/g, "")}`} size="sm" className="flex-1">
                  <Phone className="h-4 w-4" /> {t.common.call}
                </ButtonLink>
              )}
              <ButtonLink href={`/services/${service.id}`} size="sm" variant="tinted" className="flex-1">
                {t.map.details}
              </ButtonLink>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report-here FAB (desktop) */}
      {desktop && !service && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.6 }} className="absolute bottom-6 end-4 z-20">
          <Button size="lg" variant={emergency ? "danger" : "filled"} onClick={() => router.push("/report")}>
            <Camera className="h-5 w-5" /> {t.map.reportHere}
          </Button>
        </motion.div>
      )}
    </div>
  );
}

/* ───────────────────────── pieces ───────────────────────── */

function Stat({ n, label, color }: { n: number; label: string; color?: string }) {
  return (
    <div className="text-center leading-none">
      <div className="text-[17px] font-bold tabular-nums" style={{ color }}>
        {n}
      </div>
      <div className="mt-0.5 text-[10.5px] font-medium text-label-2">{label}</div>
    </div>
  );
}

function ControlBtn({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn("flex h-12 w-12 items-center justify-center transition-colors", active ? "text-accent" : "text-label")}
    >
      {children}
    </motion.button>
  );
}

function SearchBox({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  const { t } = useI18n();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex h-12 items-center gap-2 rounded-[18px] bg-black/[0.05] px-3.5 dark:bg-white/[0.08]"
    >
      <Search className="h-[18px] w-[18px] text-label-2" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.map.search}
        className="h-full flex-1 bg-transparent text-[16px] outline-none placeholder:text-label-2"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} className="flex h-5 w-5 items-center justify-center rounded-full bg-label-3 text-white">
          <X className="h-3 w-3" strokeWidth={3} />
        </button>
      )}
    </form>
  );
}

function EmergencyToggle({ on, onToggle, count, urgent }: { on: boolean; onToggle: () => void; count: number; urgent: number }) {
  const { t } = useI18n();
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={onToggle}
      className={cn(
        "relative flex w-full items-center gap-3 overflow-hidden rounded-[22px] p-3 text-start transition-colors",
        on ? "text-white" : "bg-urgent-soft",
      )}
    >
      <AnimatePresence>
        {on && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ background: "linear-gradient(110deg,#ff2d55 0%,#ff6a3d 55%,#ff9500 100%)" }}
          />
        )}
      </AnimatePresence>
      <motion.span animate={on ? { rotate: [0, -8, 8, 0], scale: [1, 1.15, 1] } : {}} transition={{ duration: 0.6 }} className="relative">
        <Emoji3D src="/3d/fire.png" size={38} />
      </motion.span>
      <span className="relative min-w-0 flex-1">
        <span className={cn("block text-[15px] font-bold", !on && "text-urgent")}>{t.map.emergencyOn}</span>
        <span className={cn("block truncate text-[12.5px]", on ? "text-white/85" : "text-label-2")}>
          {ZONE.region} · {count} · {urgent} {t.map.zoneStats.urgent}
        </span>
      </span>
      <span className={cn("relative h-[31px] w-[51px] shrink-0 rounded-full p-[2px] transition-colors", on ? "bg-white/35" : "bg-label-3/40")}>
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 600, damping: 34 }}
          className={cn("block h-[27px] w-[27px] rounded-full bg-white shadow-md", on ? "ms-auto" : "")}
        />
      </span>
    </motion.button>
  );
}

function TriageChips({ value, onChange }: { value: "all" | Triage; onChange: (v: "all" | Triage) => void }) {
  const { t } = useI18n();
  const opts: ("all" | Triage)[] = ["all", "urgent", "monitoring", "stable"];
  const colors: Record<string, string | undefined> = { urgent: "#ff3b30", monitoring: "#ff9500", stable: "#34c759" };
  return (
    <>
      {opts.map((o) => (
        <Chip key={o} active={value === o} color={colors[o]} onClick={() => onChange(o)}>
          {o !== "all" && <span className="h-2 w-2 rounded-full" style={{ background: value === o ? "#fff" : colors[o] }} />}
          {o === "all" ? t.common.all : t.common.triage[o]}
        </Chip>
      ))}
    </>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center text-[14px] text-label-2">
      <Emoji3D src="/3d/owl.png" size={64} />
      {label}
    </div>
  );
}

function CaseQuickView({
  c,
  onBack,
  helpOpen,
  setHelpOpen,
  distance,
  sheet,
}: {
  c: Case;
  onBack: () => void;
  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;
  distance: number;
  sheet?: boolean;
}) {
  const { t } = useI18n();
  const ai = useCaseAI(c);
  return (
    <div className={cn("p-4", sheet && "pt-1")}>
      <div className="relative">
        <CasePhoto photo={c.photos[0]} emoji={SPECIES_EMOJI[c.species]} emojiSize={110} sizes="400px" priority className="h-56 w-full rounded-[26px]" />
        <div className="absolute inset-x-0 top-0 flex justify-between p-3">
          <button type="button" onClick={onBack} className="glass flex h-10 w-10 items-center justify-center rounded-full" aria-label={t.common.back}>
            <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
          </button>
          <span className="glass flex h-10 items-center gap-1.5 rounded-full pe-3.5 ps-2 text-[13px] font-semibold">
            <Emoji3D src={SPECIES_EMOJI[c.species]} size={24} />
            {t.common.species[c.species]}
            {(c.count ?? 1) > 1 && ` ×${c.count}`}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <TriageBadge triage={c.triage} />
        <motion.span key={c.status} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold", c.status === "resolved" ? "bg-stable-soft text-stable" : c.status === "in_progress" ? "bg-accent-soft text-accent" : "bg-surface-2 text-label-2")}>{c.status === "resolved" && "✓ "}{t.common.status[c.status]}</motion.span>
        {c.emergencyZoneId && <span className="rounded-full bg-urgent-soft px-2.5 py-1 text-[12px] font-semibold text-urgent">🔥 {t.case.inZone}</span>}
      </div>
      <h2 className="mt-2 text-[24px] font-bold leading-tight tracking-[-0.025em]">{c.title}</h2>
      <div className="mt-1 text-[13.5px] text-label-2">
        <a href={gmaps(c.location)} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline-offset-2 hover:underline">
          📍 {c.location.address}
        </a>{" "}
        · {t.common.km(distance)} · <TimeAgo iso={c.createdAt} />
      </div>
      {c.trust && <TrustBadge level={c.trust.level} className="mt-2" />}
      <p className="mt-3 text-[15px] leading-relaxed">{c.description}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {c.conditionTags.map((tag) => (
          <span key={tag} className="rounded-full bg-surface-2 px-2.5 py-1 text-[12.5px] font-medium">
            {t.common.tags[tag] ?? tag}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-[20px] bg-surface-2/70 p-3">
        <div className="flex -space-x-2 rtl:space-x-reverse">
          <Avatar name={c.reporter.name} size={32} ring />
          {c.helpers.map((h) => (
            <Avatar key={h.user.id} name={h.user.name} size={32} ring />
          ))}
        </div>
        <div className="min-w-0 flex-1 text-[13px]">
          <div className="truncate font-semibold">
            {t.common.reportedBy} {c.reporter.name}
          </div>
          <div className="text-label-2">{t.common.helpers(c.helpers.length)}</div>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {helpOpen ? (
          <motion.div key="help" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-4 rounded-[24px] bg-surface p-4 shadow-[var(--card-shadow)]">
              <HelpPicker c={c} onDone={() => setHelpOpen(false)} />
            </div>
          </motion.div>
        ) : (
          <motion.div key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 flex gap-2">
            <Button size="lg" className="flex-1" variant={c.triage === "urgent" ? "danger" : "filled"} onClick={() => setHelpOpen(true)}>
              <HandHeart className="h-5 w-5" /> {t.map.helpCta}
            </Button>
            <ButtonLink href={`/cases/${c.id}`} size="lg" variant="tinted" className="px-5">
              <ChevronRight className="h-5 w-5 rtl:rotate-180" />
            </ButtonLink>
          </motion.div>
        )}
      </AnimatePresence>

      {ai && <AICard ai={ai} compact className="mt-4" />}
      <Link href={`/cases/${c.id}`} className="mt-3 block py-2 text-center text-[14px] font-semibold text-accent">
        {t.map.details} →
      </Link>
    </div>
  );
}

/** Apple-Maps-style list: compact bar above the tab bar → full-width sheet (tab bar slides away). */
function MobileListSheet({ items, onOpen }: { items: { c: Case; d: number }[]; onOpen: (c: Case) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const urgent = items.filter((x) => x.c.triage === "urgent").length;
  useEffect(() => {
    setTabBarHidden(open);
    return () => setTabBarHidden(false);
  }, [open]);
  return (
    <>
      <AnimatePresence>
        {open && <motion.div key="dim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="absolute inset-0 z-[25] bg-black/20" />}
      </AnimatePresence>
      <motion.div
        layout
        initial={{ y: 160 }}
        animate={{ y: 0 }}
        exit={{ y: 160 }}
        transition={{ type: "spring", stiffness: 340, damping: 34 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.12}
        onDragEnd={(_, info: PanInfo) => {
          if (info.offset.y < -40 || info.velocity.y < -400) setOpen(true);
          if (info.offset.y > 50 || info.velocity.y > 400) setOpen(false);
        }}
        className={cn(
          "absolute z-30 flex flex-col overflow-hidden bg-surface shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.25)]",
          open ? "inset-x-0 bottom-0 h-[78svh] rounded-t-[30px]" : "inset-x-3 bottom-[88px] h-[60px] rounded-[22px]",
        )}
      >
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex shrink-0 touch-none flex-col items-center px-4 pt-2 text-start">
          <span className="block h-1.5 w-9 rounded-full bg-label-3/50" />
          <span className="mt-1.5 flex w-full items-center justify-between gap-2">
            <span className="truncate font-display text-[17px] font-extrabold">{t.map.nearby}</span>
            <span className="flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold">
              {urgent > 0 && <span className="rounded-full bg-urgent-soft px-2 py-0.5 text-urgent">{urgent}</span>}
              <span className="text-label-2">{t.map.results(items.length)}</span>
              <ChevronRight className={cn("h-4 w-4 text-label-3 transition-transform", open ? "rotate-90" : "-rotate-90")} />
            </span>
          </span>
        </button>
        {open && (
          <div onPointerDownCapture={(e) => e.stopPropagation()} className="mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-[max(16px,env(safe-area-inset-bottom))] no-scrollbar">
            {items.map(({ c, d }) => (
              <CaseRow key={c.id} c={c} distance={d} onClick={() => { setOpen(false); onOpen(c); }} />
            ))}
          </div>
        )}
      </motion.div>
    </>
  );
}

/** Detail sheet with detents: half → drag up for full → drag down back to half → drag down again to close. */
function BottomSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const [full, setFull] = useState(false);
  const controls = useDragControls();
  useEffect(() => {
    setTabBarHidden(true);
    return () => setTabBarHidden(false);
  }, []);
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0, height: full ? "92svh" : "54svh" }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      drag="y"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.15, bottom: 0.7 }}
      onDragEnd={(_, info: PanInfo) => {
        const down = info.offset.y > 70 || info.velocity.y > 500;
        const up = info.offset.y < -50 || info.velocity.y < -500;
        if (up) setFull(true);
        else if (down) {
          if (full) setFull(false);
          else onClose();
        }
      }}
      className="absolute inset-x-0 bottom-0 z-[60] flex flex-col rounded-t-[30px] bg-surface shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.35)]"
    >
      <div onPointerDown={(e) => controls.start(e)} onClick={() => setFull((f) => !f)} className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5">
        <span className="h-1.5 w-10 rounded-full bg-label-3/60" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-8 no-scrollbar">{children}</div>
    </motion.div>
  );
}

