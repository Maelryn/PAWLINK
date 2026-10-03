"use client";

import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { MapView } from "@/components/map";
import { Reveal } from "@/components/motion";
import { Chip, Emoji3D, Stars } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import { SERVICE_COLOR, SERVICE_EMOJI } from "@/lib/species";
import { ratingOf, useStore } from "@/lib/store";
import type { Service, ServiceType } from "@/lib/types";
import { cn, distanceKm } from "@/lib/utils";

const TYPES: ServiceType[] = ["vet", "shelter", "transport", "boarding", "training", "store"];
const ALGIERS = { lat: 36.7538, lng: 3.0588 };

export default function ServicesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const services = useStore((s) => s.services);
  const reviews = useStore((s) => s.reviews);
  const [type, setType] = useState<"all" | ServiceType>("all");
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  // Pro listings first (paid placement, clearly labelled), then verified, then best rated
  const list = services
    .filter((s) => s.status === "approved" && (type === "all" || s.type === type))
    .filter((s) => !query || s.name.toLowerCase().includes(query) || (s.location.address ?? "").toLowerCase().includes(query))
    .map((s) => ({ s, d: distanceKm(ALGIERS, s.location), ...ratingOf(s, reviews) }))
    .sort((a, b) => Number(!!b.s.pro) - Number(!!a.s.pro) || Number(!!b.s.verified) - Number(!!a.s.verified) || b.rating - a.rating);

  return (
    <div className="min-h-[100svh] pb-32">
      <TopNav />
      <div className="mx-auto max-w-[1180px] px-4 pt-28 sm:pt-32">
        <Reveal>
          <div className="flex items-center gap-2 text-[15px] font-semibold text-accent">
            <Emoji3D src="/3d/stethoscope.png" size={22} /> {t.nav.services}
          </div>
          <h1 className="mt-1 text-[44px] font-bold leading-[1.02] tracking-[-0.045em] sm:text-[64px]">{t.services.title}</h1>
          <p className="mt-3 max-w-[560px] text-[17px] text-label-2">{t.services.subtitle}</p>
        </Reveal>

        <div className="mt-6 flex h-12 max-w-[520px] items-center gap-2 rounded-[18px] bg-surface-2 px-4">
          <Search className="h-[18px] w-[18px] text-label-2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.map.search} className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-label-2" />
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <Chip active={type === "all"} onClick={() => setType("all")}>{t.common.all}</Chip>
          {TYPES.map((ty) => (
            <Chip key={ty} active={type === ty} color={SERVICE_COLOR[ty]} onClick={() => setType(ty)}>
              <Emoji3D src={SERVICE_EMOJI[ty]} size={18} /> {t.common.service[ty]}
            </Chip>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
          <motion.div layout className="grid content-start gap-3 sm:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {list.map(({ s, d, rating, count }, i) => (
                <motion.div key={s.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", stiffness: 280, damping: 26, delay: Math.min(i * 0.03, 0.3) }}>
                  <ServiceCard s={s} d={d} rating={rating} count={count} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          <div className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
            <div className="card h-[520px] overflow-hidden rounded-[32px]">
              <MapView cases={[]} services={list.map((x) => x.s)} onSelectService={(id) => id && router.push(`/services/${id}`)} initialView={{ longitude: 3.6, latitude: 36.4, zoom: 6.4 }} />
            </div>
          </div>
        </div>

        <Link href="/login?mode=up" className="mt-8 flex items-center justify-center gap-2 rounded-[22px] border border-dashed border-separator p-4 text-[14.5px] font-semibold text-accent">
          <Emoji3D src="/3d/home.png" size={24} /> {t.svc.claim}
        </Link>
      </div>
    </div>
  );
}

function ServiceCard({ s, d, rating, count }: { s: Service; d: number; rating: number; count: number }) {
  const { t } = useI18n();
  return (
    <Link href={`/services/${s.id}`} className={cn("card block h-full rounded-[28px] p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--card-shadow-hover)] active:scale-[0.98]", s.pro && "ring-2 ring-accent/40")}>
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]" style={{ background: `${SERVICE_COLOR[s.type]}1f` }}>
          <Emoji3D src={SERVICE_EMOJI[s.type]} size={30} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide" style={{ color: SERVICE_COLOR[s.type] }}>
            {t.common.service[s.type]}
            {s.pro && <span className="rounded-full bg-accent px-1.5 py-px text-[10px] text-white normal-case">{t.svc.featured}</span>}
          </div>
          <div className="flex items-center gap-1 truncate text-[16.5px] font-semibold tracking-[-0.01em]">
            <span className="truncate">{s.name}</span>
            {s.verified && <BadgeCheck className="h-[17px] w-[17px] shrink-0 text-accent" aria-label={t.svc.verified} />}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[13px] text-label-2">
            <Stars value={rating} />
            <span className="font-semibold text-label">{rating ? rating.toFixed(1) : "—"}</span>
            <span>({count})</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[13px]">
        <span className="truncate text-label-2">{s.location.address} · {t.common.km(d)}</span>
        {s.openNow !== undefined && <span className={cn("shrink-0 font-semibold", s.openNow ? "text-stable" : "text-urgent")}>{s.openNow ? t.services.open : t.services.closed}</span>}
      </div>
    </Link>
  );
}
