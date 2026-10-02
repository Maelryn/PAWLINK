"use client";

import { AnimatePresence, motion } from "motion/react";
import { Phone, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { MapView } from "@/components/map";
import { Reveal } from "@/components/motion";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar, Chip, Emoji3D, Stars, TimeAgo } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import { SERVICES } from "@/lib/mock/data";
import { useSession } from "@/lib/auth";
import { store, useStore } from "@/lib/store";
import { gmapsDirections } from "@/lib/trust";
import { toast } from "sonner";
import Link from "next/link";
import { SERVICE_COLOR, SERVICE_EMOJI } from "@/lib/species";
import type { Service, ServiceType } from "@/lib/types";
import { cn, distanceKm } from "@/lib/utils";

const TYPES: ServiceType[] = ["vet", "shelter", "transport", "boarding", "training", "store"];
const ALGIERS = { lat: 36.7538, lng: 3.0588 };

export default function ServicesPage() {
  return (
    <Suspense>
      <Services />
    </Suspense>
  );
}

function Services() {
  const { t } = useI18n();
  const params = useSearchParams();
  const [type, setType] = useState<"all" | ServiceType>("all");
  const [openId, setOpenId] = useState<string | null>(params.get("id"));
  const list = SERVICES.filter((s) => type === "all" || s.type === type)
    .map((s) => ({ s, d: distanceKm(ALGIERS, s.location) }))
    .sort((a, b) => b.s.rating - a.s.rating);
  const open = SERVICES.find((s) => s.id === openId) ?? null;

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

        <div className="mt-8 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <Chip active={type === "all"} onClick={() => setType("all")}>
            {t.common.all}
          </Chip>
          {TYPES.map((ty) => (
            <Chip key={ty} active={type === ty} color={SERVICE_COLOR[ty]} onClick={() => setType(ty)}>
              <Emoji3D src={SERVICE_EMOJI[ty]} size={18} /> {t.common.service[ty]}
            </Chip>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_440px]">
          <motion.div layout className="grid gap-3 sm:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {list.map(({ s, d }, i) => (
                <motion.button
                  key={s.id}
                  layout
                  type="button"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 280, damping: 26, delay: i * 0.03 }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setOpenId(s.id)}
                  className={cn("card rounded-[28px] p-5 text-start transition-shadow hover:shadow-[var(--card-shadow-hover)]", openId === s.id && "ring-2 ring-accent")}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]" style={{ background: `${SERVICE_COLOR[s.type]}1f` }}>
                      <Emoji3D src={SERVICE_EMOJI[s.type]} size={30} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: SERVICE_COLOR[s.type] }}>
                        {t.common.service[s.type]}
                      </div>
                      <div className="truncate text-[16.5px] font-semibold tracking-[-0.01em]">{s.name}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-[13px] text-label-2">
                        <Stars value={s.rating} />
                        <span className="font-semibold text-label">{s.rating.toFixed(1)}</span>
                        <span>({s.reviewCount})</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[13px]">
                    <span className="truncate text-label-2">
                      {s.location.address} · {t.common.km(d)}
                    </span>
                    {s.openNow !== undefined && (
                      <span className={cn("shrink-0 font-semibold", s.openNow ? "text-stable" : "text-urgent")}>{s.openNow ? t.services.open : t.services.closed}</span>
                    )}
                  </div>
                  {s.tags && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {s.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.button>
              ))}
            </AnimatePresence>
          </motion.div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <AnimatePresence mode="wait">
              {open ? (
                <ServiceDetail key={open.id} s={open} onClose={() => setOpenId(null)} />
              ) : (
                <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card h-[520px] overflow-hidden rounded-[32px]">
                  <MapView cases={[]} services={list.map((x) => x.s)} onSelectService={(id) => id && setOpenId(id)} initialView={{ longitude: 3.6, latitude: 36.4, zoom: 6.4 }} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceDetail({ s, onClose }: { s: Service; onClose: () => void }) {
  const { t } = useI18n();
  const reviews = useStore((st) => st.reviews).filter((r) => r.serviceId === s.id);
  const bars = [5, 4, 3, 2, 1].map((n) => ({ n, v: n === 5 ? 0.78 : n === 4 ? 0.16 : n === 3 ? 0.04 : 0.01 }));
  return (
    <motion.div
      initial={{ opacity: 0, x: 30, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 30, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="card overflow-hidden rounded-[32px]"
    >
      <div className="relative h-44">
        <MapView cases={[]} services={[s]} interactive={false} initialView={{ longitude: s.location.lng, latitude: s.location.lat, zoom: 13.5, pitch: 45 }} />
        <button type="button" onClick={onClose} className="glass absolute end-3 top-3 flex h-9 w-9 items-center justify-center rounded-full" aria-label={t.common.close}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-3">
          <Emoji3D src={SERVICE_EMOJI[s.type]} size={44} />
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: SERVICE_COLOR[s.type] }}>
              {t.common.service[s.type]}
            </div>
            <div className="text-[21px] font-bold leading-tight tracking-[-0.02em]">{s.name}</div>
            <div className="text-[13px] text-label-2">{s.location.address}</div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          {s.phone && (
            <ButtonLink href={`tel:${s.phone.replace(/\s/g, "")}`} className="flex-1">
              <Phone className="h-4 w-4" /> {t.common.call}
            </ButtonLink>
          )}
          <ButtonLink href={gmapsDirections(s.location)} variant="tinted" className="flex-1">
            {t.common.directions}
          </ButtonLink>
        </div>

        <div className="mt-6 flex items-center gap-5">
          <div className="text-center">
            <div className="text-[48px] font-bold leading-none tracking-[-0.04em]">{s.rating.toFixed(1)}</div>
            <Stars value={s.rating} className="mt-1" />
            <div className="mt-1 text-[12px] text-label-2">{t.services.reviews(s.reviewCount)}</div>
          </div>
          <div className="flex-1 space-y-1">
            {bars.map((b) => (
              <div key={b.n} className="flex items-center gap-2 text-[11px] text-label-2">
                <span className="w-2">{b.n}</span>
                <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <motion.span className="absolute inset-y-0 start-0 rounded-full bg-[#ff9f0a]" initial={{ width: 0 }} animate={{ width: `${b.v * 100}%` }} transition={{ duration: 0.8, delay: 0.2 }} />
                </span>
              </div>
            ))}
          </div>
        </div>

        <ReviewForm serviceId={s.id} />
        <div className="mt-4 space-y-3">
          {reviews.length === 0 && <div className="py-4 text-center text-[14px] text-label-2">{t.services.noReviews}</div>}
          {reviews.map((r) => (
            <div key={r.id} className="rounded-[20px] bg-surface-2 p-4">
              <div className="flex items-center gap-2.5">
                <Avatar name={r.author.name} size={30} />
                <div className="flex-1">
                  <div className="text-[14px] font-semibold">{r.author.name}</div>
                  <div className="text-[11.5px] text-label-2">
                    <TimeAgo iso={r.createdAt} />
                  </div>
                </div>
                <Stars value={r.rating} />
              </div>
              <p className="mt-2 text-[14px] leading-relaxed">{r.text}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function ReviewForm({ serviceId }: { serviceId: string }) {
  const { t } = useI18n();
  const user = useSession();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  if (!user)
    return (
      <Link href="/login?next=/services" className="mt-5 block rounded-[18px] bg-surface-2 p-3.5 text-center text-[14px] font-semibold text-accent">
        {t.services.writeReview} · {t.account.signIn}
      </Link>
    );
  return (
    <form
      className="mt-5 rounded-[20px] bg-surface-2 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) return;
        store.addReview({ id: `rv${Date.now()}`, serviceId, author: { id: user.id, name: user.name, avatar: "" }, rating: rating as 1 | 2 | 3 | 4 | 5, text, createdAt: new Date().toISOString() });
        setRating(0);
        setText("");
        toast.success(t.review.thanks);
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold">{t.services.writeReview}</span>
        <span className="flex gap-1" aria-label={t.review.rate}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} className={cn("text-[22px] leading-none transition-transform active:scale-90", n <= rating ? "text-[#ff9f0a]" : "text-label-3")}>
              ★
            </button>
          ))}
        </span>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={t.review.placeholder} className="mt-2 w-full resize-none rounded-[14px] bg-surface p-3 text-[14px] outline-none" />
      <button type="submit" disabled={!rating} className="mt-2 h-9 rounded-full bg-accent px-4 text-[13.5px] font-semibold text-white disabled:opacity-40">
        {t.review.send}
      </button>
    </form>
  );
}
