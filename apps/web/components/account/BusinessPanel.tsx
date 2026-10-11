"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { openPaywall } from "@/lib/ui";
import { Avatar, Emoji3D, Stars, TimeAgo } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import { SERVICE_EMOJI } from "@/lib/species";
import { ratingOf, store, useStore } from "@/lib/store";
import type { Review, User } from "@/lib/types";
import { cn, hashHue } from "@/lib/utils";

const card = "card rounded-[28px] p-5";
const field = "h-12 w-full rounded-[16px] bg-surface-2 px-4 text-[15px] outline-none ring-accent/40 placeholder:text-label-2 focus:ring-2";

/** "My business" tab for vets / shelters / stores: listing, verification, appointments, reviews, Pro. */
export function BusinessPanel({ me }: { me: User }) {
  const { t, locale } = useI18n();
  const s = useStore((st) => st.services).find((x) => x.id === me.serviceId);
  const allReviews = useStore((st) => st.reviews);
  const bookings = useStore((st) => st.bookings).filter((b) => b.serviceId === me.serviceId);
  const [f, setF] = useState({ name: s?.name ?? "", phone: s?.phone ?? "", description: s?.description ?? "", hours: s?.hours ?? "", address: s?.location.address ?? "" });
  if (!s) return null;

  const reviews = allReviews.filter((r) => r.serviceId === s.id);
  const { rating, count } = ratingOf(s, allReviews);
  const isPro = !!me.pro && new Date(me.pro.until) > new Date();
  const views = 120 + (hashHue(s.id) % 300); // placeholder until analytics exist
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale === "ar" ? "ar-DZ" : locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      {s.status === "pending" && (
        <div className="flex gap-3 rounded-[24px] bg-monitor-soft p-4">
          <Emoji3D src="/3d/shield.png" size={36} className="shrink-0" />
          <div>
            <div className="font-semibold text-monitor">{t.biz.pendingTitle}</div>
            <p className="text-[13.5px] text-label-2">{t.biz.pending}</p>
          </div>
        </div>
      )}

      {/* stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { e: "/3d/star.png", v: rating ? rating.toFixed(1) : "—", l: t.services.reviews(count) },
          { e: "/3d/sparkles.png", v: isPro ? views : "—", l: t.biz.views },
          { e: "/3d/phone.png", v: isPro ? Math.round(views / 9) : "—", l: t.biz.calls },
        ].map((x) => (
          <div key={x.l} className="card flex min-w-0 flex-col gap-2 rounded-[24px] p-4">
            <Emoji3D src={x.e} size={32} />
            <div className="text-[24px] font-bold leading-none tabular-nums">{x.v}</div>
            <div className="text-[12px] leading-tight text-label-2">{x.l}</div>
          </div>
        ))}
      </div>

      {/* Pro */}
      {isPro ? (
        <div className="flex items-center gap-3 rounded-[24px] bg-gradient-to-r from-[#0a7cff] to-[#5e5ce6] p-4 text-white">
          <Emoji3D src="/3d/star.png" size={36} />
          <div className="flex-1">
            <div className="font-bold">{t.biz.proTitle}</div>
            <div className="text-[13px] text-white/80">{t.biz.proActive} {fmt(me.pro!.until)}</div>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#0a7cff] via-[#5e5ce6] to-[#ff2d78] p-5 text-white">
          <div className="text-[18px] font-bold">{t.biz.proTitle}</div>
          <p className="mt-1 max-w-[440px] text-[14px] text-white/85">{t.biz.proPitch}</p>
          <Button variant="white" size="sm" className="mt-3" onClick={() => openPaywall()}>{t.biz.goPro} · {t.pro.proPrice}{t.pro.perMonth}</Button>
        </div>
      )}

      {/* listing */}
      <form
        className={cn(card, "space-y-3")}
        onSubmit={(e) => {
          e.preventDefault();
          store.updateService(s.id, { name: f.name, phone: f.phone, description: f.description, hours: f.hours, location: { ...s.location, address: f.address } });
          toast.success(t.acct.saved);
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[18px] font-bold"><Emoji3D src={SERVICE_EMOJI[s.type]} size={26} /> {t.biz.listing}</h2>
          {s.status === "approved" && <Link href={`/services/${s.id}`} className="text-[13.5px] font-semibold text-accent">{t.map.details} →</Link>}
        </div>
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t.biz.bizName} className={field} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder={t.acct.phone} className={field} dir="ltr" />
          <input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder={t.acct.city} className={field} />
        </div>
        <input value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} placeholder={t.biz.hours} className={field} />
        <textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder={t.biz.description} className={cn(field, "h-auto resize-none py-3")} />
        <Button type="submit">{t.acct.save}</Button>
      </form>

      {/* appointments */}
      <section className={card}>
        <h2 className="mb-3 text-[18px] font-bold">{t.biz.bookings}</h2>
        {!isPro && (
          <button type="button" onClick={() => openPaywall()} className="flex w-full items-center gap-3 rounded-[18px] bg-accent-soft p-3.5 text-start">
            <span className="flex h-9 items-center gap-1 rounded-full bg-gradient-to-r from-[#0a7cff] to-[#5e5ce6] px-3 text-[13px] font-bold text-white">🔒 {t.pay.locked}</span>
            <span className="flex-1 text-[13.5px] text-label">{t.biz.proPitch}</span>
          </button>
        )}
        {isPro && bookings.length === 0 && <p className="text-[14px] text-label-2">{t.biz.noBookings}</p>}
        <div className="space-y-2">
          {bookings.map((b) => (
            <div key={b.id} className="rounded-[18px] bg-surface-2 p-3.5">
              <div className="flex items-center gap-3">
                <Avatar name={b.from.name} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{b.from.name} · {b.animal}</div>
                  <div className="text-[12.5px] text-label-2">{new Date(`${b.date}T12:00`).toLocaleDateString(locale === "ar" ? "ar-DZ" : locale === "en" ? "en-GB" : "fr-FR", { weekday: "short", day: "numeric", month: "short" })} · <span dir="ltr">{b.time}</span></div>
                </div>
                {b.status === "sent" ? (
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => store.answerBooking(b.id, "confirmed")} className="flex h-8 w-8 items-center justify-center rounded-full bg-stable text-white" aria-label={t.biz.confirm}><Check className="h-4 w-4" /></button>
                    <button type="button" onClick={() => store.answerBooking(b.id, "declined")} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface" aria-label={t.biz.decline}><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <span className={cn("text-[12.5px] font-semibold", b.status === "confirmed" ? "text-stable" : "text-urgent")}>{b.status === "confirmed" ? t.biz.confirm : t.biz.decline} ✓</span>
                )}
              </div>
              {b.reason && <p className="mt-2 text-[14px]">{b.reason}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* reviews */}
      <section className={card}>
        <h2 className="mb-3 text-[18px] font-bold">{t.biz.reviews}</h2>
        {reviews.length === 0 && <p className="text-[14px] text-label-2">{t.services.noReviews}</p>}
        <div className="space-y-3">
          {reviews.map((r) => (
            <ReviewReply key={r.id} r={r} canReply={isPro} />
          ))}
        </div>
      </section>
    </>
  );
}

function ReviewReply({ r, canReply }: { r: Review; canReply: boolean }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  return (
    <div className="rounded-[18px] bg-surface-2 p-3.5">
      <div className="flex items-center gap-2.5">
        <Avatar name={r.author.name} size={30} />
        <div className="flex-1">
          <div className="text-[14px] font-semibold">{r.author.name}</div>
          <div className="text-[11.5px] text-label-2"><TimeAgo iso={r.createdAt} /></div>
        </div>
        <Stars value={r.rating} />
      </div>
      <p className="mt-2 text-[14px]">{r.text}</p>
      {r.reply ? (
        <div className="mt-2 rounded-[14px] bg-surface p-3 text-[13.5px]"><b>{t.biz.replied}:</b> {r.reply}</div>
      ) : (
        canReply && (
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) store.replyReview(r.id, text.trim()); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t.biz.replyPh} className="h-10 flex-1 rounded-full bg-surface px-4 text-[14px] outline-none" />
            <Button type="submit" size="sm">{t.biz.reply}</Button>
          </form>
        )
      )}
    </div>
  );
}
