"use client";

import { motion } from "motion/react";
import { Mascot } from "@/components/brand/Mascot";
import { ArrowLeft, BadgeCheck, Clock, Navigation, Phone } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { TopNav } from "@/components/layout/TopNav";
import { MapView } from "@/components/map";
import { Reveal } from "@/components/motion";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Avatar, Emoji3D, Stars, TimeAgo } from "@/components/ui/primitives";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { SERVICE_COLOR, SERVICE_EMOJI } from "@/lib/species";
import { ratingOf, store, useStore } from "@/lib/store";
import { gmapsDirections } from "@/lib/trust";
import type { Service } from "@/lib/types";
import { cn } from "@/lib/utils";

const field = "h-11 w-full rounded-[14px] bg-surface px-3.5 text-[14.5px] outline-none ring-accent/40 focus:ring-2";

export default function ServicePage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const s = useStore((st) => st.services).find((x) => x.id === id);
  const allReviews = useStore((st) => st.reviews);

  if (!s)
    return (
      <>
        <TopNav />
        <div className="flex min-h-[80svh] flex-col items-center justify-center gap-4 text-label-2">
          <Mascot size={90} /> {t.svc.notFound}
          <ButtonLink href="/services">{t.nav.services}</ButtonLink>
        </div>
      </>
    );

  const { rating, count } = ratingOf(s, allReviews);
  const reviews = allReviews.filter((r) => r.serviceId === s.id);
  const bars = [5, 4, 3, 2, 1].map((n) => {
    const real = reviews.filter((r) => r.rating === n).length;
    const share = count ? (real + (n === Math.round(s.rating) ? s.reviewCount : 0)) / count : 0;
    return { n, v: share };
  });

  return (
    <div className="min-h-[100svh] pb-32">
      <TopNav />
      <div className="mx-auto max-w-[1000px] px-4 pt-24 sm:pt-28">
        <Link href="/services" className="glass mb-4 inline-flex h-10 items-center gap-1.5 rounded-full pe-4 ps-3 text-[14px] font-semibold">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t.nav.services}
        </Link>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card overflow-hidden rounded-[34px]">
          <div className="h-56 sm:h-72">
            <MapView cases={[]} services={[s]} interactive={false} initialView={{ longitude: s.location.lng, latitude: s.location.lat, zoom: 14, pitch: 45 }} />
          </div>
          <div className="p-5 sm:p-7">
            <div className="flex items-start gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px]" style={{ background: `${SERVICE_COLOR[s.type]}1f` }}>
                <Emoji3D src={SERVICE_EMOJI[s.type]} size={42} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold uppercase tracking-wide" style={{ color: SERVICE_COLOR[s.type] }}>
                  {t.common.service[s.type]}
                  {s.pro && <span className="rounded-full bg-accent px-2 py-0.5 text-[10.5px] normal-case text-white">{t.svc.featured}</span>}
                </div>
                <h1 className="flex items-center gap-1.5 text-[26px] font-bold leading-tight tracking-[-0.03em] sm:text-[32px]">
                  {s.name}
                  {s.verified && <BadgeCheck className="h-6 w-6 shrink-0 text-accent" aria-label={t.svc.verified} />}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[14px] text-label-2">
                  <Stars value={rating} /> <b className="text-label">{rating ? rating.toFixed(1) : "—"}</b> · {t.services.reviews(count)} · {s.location.address}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:flex">
              {s.phone && (
                <ButtonLink href={`tel:${s.phone.replace(/\s/g, "")}`} className="sm:flex-1">
                  <Phone className="h-4 w-4" /> {t.common.call}
                </ButtonLink>
              )}
              <ButtonLink href={gmapsDirections(s.location)} variant="tinted" className="sm:flex-1">
                <Navigation className="h-4 w-4" /> {t.common.directions}
              </ButtonLink>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-[12.5px] font-semibold uppercase tracking-wide text-label-2">{t.svc.about}</div>
                <p className="mt-1 text-[15px] leading-relaxed">{s.description}</p>
                {s.tags && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.tags.map((tag) => <span key={tag} className="rounded-full bg-surface-2 px-2.5 py-1 text-[12.5px] font-medium">{tag}</span>)}
                  </div>
                )}
              </div>
              <div>
                <div className="text-[12.5px] font-semibold uppercase tracking-wide text-label-2">{t.svc.hours}</div>
                <p className="mt-1 flex items-center gap-2 text-[15px]">
                  <Clock className="h-4 w-4 text-label-2" /> {s.hours}
                  {s.openNow !== undefined && <span className={cn("font-semibold", s.openNow ? "text-stable" : "text-urgent")}>· {s.openNow ? t.services.open : t.services.closed}</span>}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          <Reveal>
            <section className="card rounded-[30px] p-5 sm:p-6">
              <h2 className="text-[20px] font-bold">{t.biz.reviews}</h2>
              <div className="mt-4 flex items-center gap-5">
                <div className="text-center">
                  <div className="text-[46px] font-bold leading-none tracking-[-0.04em]">{rating ? rating.toFixed(1) : "—"}</div>
                  <Stars value={rating} className="mt-1" />
                  <div className="mt-1 text-[12px] text-label-2">{t.services.reviews(count)}</div>
                </div>
                <div className="flex-1 space-y-1">
                  {bars.map((b) => (
                    <div key={b.n} className="flex items-center gap-2 text-[11px] text-label-2">
                      <span className="w-2">{b.n}</span>
                      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <motion.span className="absolute inset-y-0 start-0 rounded-full bg-[#ff9f0a]" initial={{ width: 0 }} animate={{ width: `${b.v * 100}%` }} transition={{ duration: 0.8 }} />
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
                      <Avatar name={r.author.name} size={32} />
                      <div className="flex-1">
                        <div className="text-[14px] font-semibold">{r.author.name}</div>
                        <div className="text-[11.5px] text-label-2"><TimeAgo iso={r.createdAt} /></div>
                      </div>
                      <Stars value={r.rating} />
                    </div>
                    {r.text && <p className="mt-2 text-[14px] leading-relaxed">{r.text}</p>}
                    {r.reply && (
                      <div className="mt-2 rounded-[14px] bg-surface p-3 text-[13.5px]">
                        <div className="text-[12px] font-semibold text-accent">{t.svc.owner}</div>
                        {r.reply}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </Reveal>
          <div className="lg:sticky lg:top-24 lg:self-start">
            <BookingCard s={s} />
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingCard({ s }: { s: Service }) {
  const { t } = useI18n();
  const me = useSession();
  const router = useRouter();
  const [f, setF] = useState({ date: "", time: "", animal: "", reason: "" });
  const mine = useStore((st) => st.bookings).find((b) => b.serviceId === s.id && b.from.id === me?.id && b.status !== "declined");

  return (
    <section className="card rounded-[30px] p-5">
      <h2 className="flex items-center gap-2 text-[18px] font-bold"><Emoji3D src="/3d/bell.png" size={26} /> {t.svc.book}</h2>
      {!s.pro ? (
        <p className="mt-2 text-[14px] text-label-2">{t.svc.onlyPro}</p>
      ) : mine ? (
        <div className="mt-3 rounded-[18px] bg-surface-2 p-4 text-[14px]">
          <div className="font-semibold" dir="ltr">{mine.date} · {mine.time}</div>
          <div className={cn("mt-1 font-semibold", mine.status === "confirmed" ? "text-stable" : "text-monitor")}>{mine.status === "confirmed" ? `${t.biz.confirm} ✓` : t.market.status.sent}</div>
        </div>
      ) : (
        <form
          className="mt-3 space-y-2.5 rounded-[20px] bg-surface-2 p-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!me) return router.push(`/login?next=/services/${s.id}`);
            store.book({ id: `b${Date.now()}`, serviceId: s.id, from: { id: me.id, name: me.name, avatar: "" }, ...f, status: "sent", createdAt: new Date().toISOString() });
            toast.success(t.svc.sent);
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <input required type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={field} aria-label={t.svc.date} />
            <input required type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} className={field} aria-label={t.svc.time} />
          </div>
          <input required value={f.animal} onChange={(e) => setF({ ...f, animal: e.target.value })} placeholder={t.svc.animal} className={field} />
          <input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder={t.svc.reasonPh} className={field} />
          <Button type="submit" className="w-full">{me ? t.svc.send : t.account.needLogin}</Button>
        </form>
      )}
    </section>
  );
}

function ReviewForm({ serviceId }: { serviceId: string }) {
  const { t } = useI18n();
  const user = useSession();
  const existing = useStore((st) => st.reviews).find((r) => r.serviceId === serviceId && r.author.id === user?.id);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [text, setText] = useState(existing?.text ?? "");
  if (!user)
    return (
      <Link href={`/login?next=/services/${serviceId}`} className="mt-5 block rounded-[18px] bg-surface-2 p-3.5 text-center text-[14px] font-semibold text-accent">
        {t.services.writeReview} · {t.account.signIn}
      </Link>
    );
  return (
    <form
      className="mt-5 rounded-[20px] bg-surface-2 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) return;
        store.addReview({ id: existing?.id ?? `rv${Date.now()}`, serviceId, author: { id: user.id, name: user.name, avatar: "" }, rating: rating as 1 | 2 | 3 | 4 | 5, text, createdAt: new Date().toISOString() });
        toast.success(t.review.thanks);
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold">{existing ? t.svc.yourReview : t.services.writeReview}</span>
        <span className="flex gap-1" aria-label={t.review.rate}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} className={cn("text-[24px] leading-none transition-transform active:scale-90", n <= rating ? "text-[#ff9f0a]" : "text-label-3")}>★</button>
          ))}
        </span>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={t.review.placeholder} className="mt-2 w-full resize-none rounded-[14px] bg-surface p-3 text-[14px] outline-none" />
      <button type="submit" disabled={!rating} className="mt-2 h-9 rounded-full bg-accent px-4 text-[13.5px] font-semibold text-white disabled:opacity-40">{t.review.send}</button>
    </form>
  );
}
