"use client";

import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, LayoutGrid, Map as MapIcon, MapPin, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { MapView } from "@/components/map";
import { Emoji3D, Segmented } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import { SERVICE_COLOR, SERVICE_EMOJI } from "@/lib/species";
import { ratingOf, useStore } from "@/lib/store";
import type { Service, ServiceType } from "@/lib/types";
import { cn, distanceKm } from "@/lib/utils";
import { inAlgeria } from "@/lib/trust";
import { toast } from "sonner";

const TYPES: ServiceType[] = ["vet", "shelter", "transport", "boarding", "training", "store"];
const ALGIERS = { lat: 36.7538, lng: 3.0588 };

/** Pastel card backgrounds per category (the "tile" look of iOS apps). */
const TILE: Record<ServiceType, string> = {
  vet: "linear-gradient(150deg,#e3efff 0%,#c9dcff 100%)",
  shelter: "linear-gradient(150deg,#f3e6ff 0%,#e2cbff 100%)",
  transport: "linear-gradient(150deg,#fff1dc 0%,#ffdcae 100%)",
  boarding: "linear-gradient(150deg,#ddf6ff 0%,#bfe9fb 100%)",
  training: "linear-gradient(150deg,#e2f8e6 0%,#c3ecca 100%)",
  store: "linear-gradient(150deg,#ffe4ec 0%,#ffc9d8 100%)",
};

export default function ServicesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const services = useStore((s) => s.services);
  const reviews = useStore((s) => s.reviews);
  const [type, setType] = useState<"all" | ServiceType>("all");
  const [view, setView] = useState<"grid" | "map">("grid");
  const [q, setQ] = useState("");
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const locate = () => {
    if (origin) return setOrigin(null);
    if (!navigator.geolocation) return toast(t.svc.locFail);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (inAlgeria(here)) setOrigin(here);
        else toast(t.svc.locFail);
      },
      () => {
        setLocating(false);
        toast(t.svc.locFail);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  };
  const query = q.trim().toLowerCase();

  // Pro listings first (paid placement, labelled), then verified, then best rated
  const list = services
    .filter((s) => s.status === "approved" && (type === "all" || s.type === type))
    .filter((s) => !query || s.name.toLowerCase().includes(query) || (s.location.address ?? "").toLowerCase().includes(query))
    .map((s) => ({ s, d: distanceKm(origin ?? ALGIERS, s.location), ...ratingOf(s, reviews) }))
    .sort((a, b) => Number(!!b.s.pro) - Number(!!a.s.pro) || Number(!!b.s.verified) - Number(!!a.s.verified) || b.rating - a.rating);

  return (
    <div className="min-h-[100svh] pb-32">
      <TopNav />
      <div className="mx-auto max-w-[1180px] px-4 pt-[76px] sm:pt-24">
        {/* header: title + view switch */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[30px] font-black sm:text-[38px]">{t.nav.services}</h1>
          <Segmented
            layoutId="svc-view"
            value={view}
            onChange={setView}
            options={[
              { value: "grid", label: <LayoutGrid className="h-4 w-4" /> },
              { value: "map", label: <MapIcon className="h-4 w-4" /> },
            ]}
          />
        </div>

        {/* search */}
        <div className="mt-3 flex gap-2">
          <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-surface-2 px-4">
            <Search className="h-[18px] w-[18px] text-label-2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.map.search} className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-label-2" />
          </div>
          <button
            type="button"
            onClick={locate}
            aria-pressed={!!origin}
            className={cn("flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold transition-[background,transform] active:scale-95", origin ? "bg-accent text-white" : "bg-surface-2")}
          >
            <MapPin className={cn("h-4 w-4", origin ? "text-white" : "text-accent", locating && "animate-pulse")} />
            {locating ? t.svc.locating : origin ? t.svc.nearMe : "Alger"}
          </button>
        </div>

        {/* categories as round icon tiles */}
        <div className="-mx-4 mt-3 flex gap-4 overflow-x-auto px-4 py-2 no-scrollbar">
          {(["all", ...TYPES] as const).map((ty) => {
            const on = type === ty;
            return (
              <button key={ty} type="button" onClick={() => setType(ty)} className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
                <motion.span
                  whileTap={{ scale: 0.9 }}
                  className={cn("flex h-[60px] w-[60px] items-center justify-center rounded-full transition-shadow", on ? "ring-[3px] ring-accent ring-offset-2 ring-offset-bg" : "")}
                  style={{ background: ty === "all" ? "linear-gradient(150deg,#eef0f5,#dfe3ec)" : TILE[ty] }}
                >
                  {ty === "all" ? <SlidersHorizontal className="h-6 w-6 text-label" /> : <Emoji3D src={SERVICE_EMOJI[ty]} size={34} />}
                </motion.span>
                <span className={cn("max-w-full truncate text-[12px]", on ? "font-bold text-accent" : "font-medium text-label-2")}>{ty === "all" ? t.common.all : t.common.service[ty]}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-baseline justify-between">
          <h2 className="text-[20px] font-extrabold">{t.services.title}</h2>
          <span className="text-[13px] text-label-2">{list.length}</span>
        </div>

        {view === "map" ? (
          <div className="card mt-3 h-[68svh] overflow-hidden rounded-[28px]">
            <MapView cases={[]} services={list.map((x) => x.s)} onSelectService={(id) => id && router.push(`/services/${id}`)} initialView={{ longitude: 3.6, latitude: 36.4, zoom: 6.4 }} />
          </div>
        ) : (
          <motion.div layout className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {list.map(({ s, d, rating, count }, i) => (
                <motion.div key={s.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", stiffness: 300, damping: 28, delay: Math.min(i * 0.025, 0.25) }}>
                  <ServiceTile s={s} d={d} rating={rating} count={count} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        <Link href="/pro" className="mt-8 flex items-center gap-4 rounded-[26px] bg-gradient-to-r from-[#0a7cff] to-[#5e5ce6] p-5 text-white">
          <Emoji3D src="/3d/home.png" size={44} />
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold">{t.svc.claim}</span>
            <span className="block text-[13px] text-white/80">{t.pro.subtitle}</span>
          </span>
          <span className="text-[22px]">›</span>
        </Link>
      </div>
    </div>
  );
}

/** Marketplace-style card: big visual on top, name / rating / distance under. */
function ServiceTile({ s, d, rating, count }: { s: Service; d: number; rating: number; count: number }) {
  const { t } = useI18n();
  return (
    <Link href={`/services/${s.id}`} className="group block active:scale-[0.98]">
      <div className="relative aspect-square overflow-hidden rounded-[22px]" style={{ background: TILE[s.type] }}>
        <div className="absolute inset-0 flex items-center justify-center transition-transform duration-500 group-hover:scale-110">
          <Emoji3D src={SERVICE_EMOJI[s.type]} size={92} className="drop-shadow-[0_14px_18px_rgba(0,0,0,0.18)]" />
        </div>
        {s.pro && <span className="absolute start-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-accent shadow-sm">{t.svc.featured}</span>}
        {s.openNow !== undefined && (
          <span className={cn("absolute bottom-2.5 start-2.5 rounded-full px-2 py-0.5 text-[11px] font-bold text-white", s.openNow ? "bg-stable" : "bg-label-2")}>
            {s.openNow ? t.services.open : t.services.closed}
          </span>
        )}
        <span className="absolute bottom-2.5 end-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">{t.common.km(d)}</span>
      </div>
      <div className="px-1 pt-2">
        <div className="flex items-center gap-1">
          <span className="truncate text-[15px] font-semibold leading-tight">{s.name}</span>
          {s.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-accent" aria-label={t.svc.verified} />}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[12.5px] text-label-2">
          <span className="text-[#ff9f0a]">★</span>
          <span className="font-semibold text-label">{rating ? rating.toFixed(1) : "—"}</span>
          <span>({count})</span>
          <span className="truncate">· {s.location.address}</span>
        </div>
        <div className="mt-0.5 text-[12px] font-medium" style={{ color: SERVICE_COLOR[s.type] }}>{t.common.service[s.type]}</div>
      </div>
    </Link>
  );
}
