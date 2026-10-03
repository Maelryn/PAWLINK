"use client";

import { Check, MessageCircle, Phone, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Avatar } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import { store, useStore } from "@/lib/store";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

const Thumb = ({ src }: { src: string }) => (
  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[14px]">
    <Image src={src} alt="" fill unoptimized={src.startsWith("data:")} sizes="48px" className="object-cover" />
  </div>
);

/** Dashboard: my listings + requests I received + requests I sent (marketplace logic). */
export function MyAdoptions({ me }: { me: User }) {
  const { t } = useI18n();
  const adoptions = useStore((s) => s.adoptions);
  const requests = useStore((s) => s.requests);
  const mine = adoptions.filter((a) => a.ownerId === me.id);
  const received = requests.filter((r) => mine.some((a) => a.id === r.adoptionId));
  const sent = requests.filter((r) => r.from.id === me.id);
  const title = "px-3 pb-1 pt-3 text-[20px] font-bold tracking-[-0.02em]";
  const empty = <div className="px-3 py-4 text-[14px] text-label-2">{t.market.none}</div>;

  return (
    <section className="card space-y-2 rounded-[32px] p-3">
      <div className="flex items-center justify-between pe-2">
        <h2 className={title}>{t.market.myListings}</h2>
        <Link href="/adopt/new" className="pt-3 text-[14px] font-semibold text-accent">+ {t.market.post}</Link>
      </div>
      {mine.length === 0 && empty}
      {mine.map((a) => (
        <Link key={a.id} href={`/adopt/${a.id}`} className="flex items-center gap-3 rounded-[20px] p-2.5 hover:bg-surface-2">
          <Thumb src={a.photos[0]} />
          <span className="flex-1 font-semibold">{a.name}</span>
          <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold", a.status === "approved" ? "bg-stable-soft text-stable" : a.status === "pending" ? "bg-monitor-soft text-monitor" : "bg-urgent-soft text-urgent")}>
            {t.market[a.status]}
          </span>
        </Link>
      ))}

      <h2 className={title}>{t.market.received}</h2>
      {received.length === 0 && empty}
      {received.map((r) => {
        const a = adoptions.find((x) => x.id === r.adoptionId)!;
        return (
          <div key={r.id} className="rounded-[20px] bg-surface-2 p-3.5">
            <div className="flex items-center gap-3">
              <Avatar name={r.from.name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-semibold">{r.from.name} → {a.name}</div>
                <div className="text-[12.5px] text-label-2">{t.market.housing[r.housing]}{r.experience ? ` · ${t.market.experience}` : ""}</div>
              </div>
            </div>
            <p className="mt-2 text-[14px]">{r.message}</p>
            {r.status === "sent" ? (
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => store.answerRequest(r.id, "accepted")} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-stable text-[13.5px] font-semibold text-white"><Check className="h-4 w-4" /> {t.market.accept}</button>
                <button type="button" onClick={() => store.answerRequest(r.id, "declined")} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-surface text-[13.5px] font-semibold"><X className="h-4 w-4" /> {t.market.decline}</button>
              </div>
            ) : (
              <div className={cn("mt-2 text-[13px] font-semibold", r.status === "accepted" ? "text-stable" : "text-urgent")}>{t.market.status[r.status]}</div>
            )}
          </div>
        );
      })}

      <h2 className={title}>{t.market.myRequests}</h2>
      {sent.length === 0 && empty}
      {sent.map((r) => {
        const a = adoptions.find((x) => x.id === r.adoptionId)!;
        const phone = (a.ownerPhone ?? "").replace(/\s/g, "");
        return (
          <div key={r.id} className="flex items-center gap-3 rounded-[20px] p-2.5">
            <Thumb src={a.photos[0]} />
            <Link href={`/adopt/${a.id}`} className="min-w-0 flex-1">
              <div className="font-semibold">{a.name}</div>
              <div className={cn("text-[12.5px] font-medium", r.status === "accepted" ? "text-stable" : r.status === "declined" ? "text-urgent" : "text-monitor")}>{t.market.status[r.status]}</div>
            </Link>
            {r.status === "accepted" && phone && (
              <>
                <a href={`tel:${phone}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white" aria-label={t.common.call}><Phone className="h-4 w-4" /></a>
                <a href={`https://wa.me/${phone.replace("+", "")}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-stable text-white" aria-label={t.market.whatsapp}><MessageCircle className="h-4 w-4" /></a>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}

/** Admin: listings waiting for approval. */
export function AdoptionQueue() {
  const { t } = useI18n();
  const pending = useStore((s) => s.adoptions).filter((a) => a.status === "pending");
  return (
    <section className="card mb-5 overflow-hidden rounded-[28px]">
      <div className="flex items-center justify-between p-5">
        <h2 className="text-[19px] font-bold">{t.market.adminQueue}</h2>
        <span className="rounded-full bg-monitor-soft px-3 py-1 text-[13px] font-semibold text-monitor">{pending.length}</span>
      </div>
      {pending.length === 0 && <div className="px-5 pb-5 text-[14px] text-label-2">{t.market.none}</div>}
      {pending.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-3 border-t border-separator px-5 py-3">
          <div className="flex gap-1.5">{a.photos.map((p, i) => <Thumb key={i} src={p} />)}</div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{a.name} · {t.common.species[a.species]}</div>
            <div className="truncate text-[12.5px] text-label-2">{a.shelter.name} · {a.location.address}</div>
          </div>
          <button type="button" onClick={() => store.moderateAdoption(a.id, "approved")} className="flex h-9 items-center gap-1.5 rounded-full bg-stable-soft px-3.5 text-[13px] font-semibold text-stable"><Check className="h-4 w-4" /> {t.admin.approve}</button>
          <button type="button" onClick={() => store.moderateAdoption(a.id, "rejected")} className="flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold text-label-2"><X className="h-4 w-4" /> {t.market.decline}</button>
        </div>
      ))}
    </section>
  );
}

/** Admin: new businesses waiting for license / registration check. */
export function ServiceQueue() {
  const { t } = useI18n();
  const pending = useStore((s) => s.services).filter((s) => s.status === "pending");
  return (
    <section className="card mb-5 overflow-hidden rounded-[28px]">
      <div className="flex items-center justify-between p-5">
        <h2 className="text-[19px] font-bold">{t.biz.pendingTitle} · {t.nav.services}</h2>
        <span className="rounded-full bg-monitor-soft px-3 py-1 text-[13px] font-semibold text-monitor">{pending.length}</span>
      </div>
      {pending.length === 0 && <div className="px-5 pb-5 text-[14px] text-label-2">{t.market.none}</div>}
      {pending.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-3 border-t border-separator px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{s.name} · {t.common.service[s.type]}</div>
            <div className="truncate text-[12.5px] text-label-2">{s.location.address} · {s.phone}</div>
          </div>
          <button type="button" onClick={() => store.moderateService(s.id, true)} className="flex h-9 items-center gap-1.5 rounded-full bg-stable-soft px-3.5 text-[13px] font-semibold text-stable"><Check className="h-4 w-4" /> {t.admin.approve}</button>
          <button type="button" onClick={() => store.moderateService(s.id, false)} className="flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold text-label-2"><X className="h-4 w-4" /> {t.market.decline}</button>
        </div>
      ))}
    </section>
  );
}
