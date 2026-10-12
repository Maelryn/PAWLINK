"use client";

import { Check, MessageCircle, Pencil, Phone, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Avatar } from "@/components/ui/primitives";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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
        <div key={a.id} className="flex items-center gap-2 rounded-[20px] p-2.5 hover:bg-surface-2">
          <Link href={`/adopt/${a.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Thumb src={a.photos[0]} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{a.name}</span>
              {a.pendingEdit && <span className="block truncate text-[12px] font-medium text-monitor">{t.post.pending}</span>}
            </span>
            <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold", a.status === "approved" || a.status === "adopted" ? "bg-stable-soft text-stable" : a.status === "pending" ? "bg-monitor-soft text-monitor" : "bg-urgent-soft text-urgent")}>
              {t.market[a.status]}
            </span>
          </Link>
          {a.status !== "adopted" && !a.reservedFor && (
            <ConfirmButton onConfirm={() => { store.removeAdoption(a.id); toast(t.life.deleted); }} className="flex h-10 shrink-0 items-center justify-center rounded-full bg-surface-2 px-3 text-label-2" armedClassName="bg-urgent text-white text-[12px] font-semibold">
              <Trash2 className="h-4 w-4" aria-label={t.life.delete} />
            </ConfirmButton>
          )}
          {a.status !== "adopted" && (
            <Link href={`/adopt/new?edit=${a.id}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-label-2 transition-transform active:scale-90" aria-label={t.post.edit} title={t.post.edit}>
              <Pencil className="h-4 w-4" />
            </Link>
          )}
        </div>
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
            {r.status === "sent" && a.reservedFor ? (
              <div className="mt-2 text-[12.5px] font-medium text-label-2">{t.life.busy}</div>
            ) : r.status === "sent" ? (
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => store.answerRequest(r.id, "accepted")} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-stable text-[13.5px] font-semibold text-white"><Check className="h-4 w-4" /> {t.market.accept}</button>
                <button type="button" onClick={() => store.answerRequest(r.id, "declined")} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-surface text-[13.5px] font-semibold"><X className="h-4 w-4" /> {t.market.decline}</button>
              </div>
            ) : (
              <div className={cn("mt-2 text-[13px] font-semibold", r.status === "accepted" ? "text-stable" : r.status === "cancelled" ? "text-label-2" : "text-urgent")}>{t.market.status[r.status]}</div>
            )}
            {r.status === "accepted" && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {r.fromPhone && (
                  <>
                    <a href={`tel:${r.fromPhone.replace(/\s/g, "")}`} className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13.5px] font-semibold text-white" dir="ltr"><Phone className="h-4 w-4" /> {r.fromPhone}</a>
                    <a href={`https://wa.me/${r.fromPhone.replace(/[\s+]/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full bg-stable text-white" aria-label={t.market.whatsapp}><MessageCircle className="h-4 w-4" /></a>
                  </>
                )}
                {a.status === "approved" && a.reservedFor === r.id && (
                  <div className="mt-1 w-full space-y-2">
                    <p className="text-[12.5px] text-label-2">{t.life.howEnded}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => { store.markAdopted(a.id); toast.success(t.life.adopted); }} className="flex h-10 items-center justify-center rounded-full bg-stable text-[13.5px] font-semibold text-white">
                        {t.life.adopted}
                      </button>
                      <ConfirmButton onConfirm={() => { store.reopenAdoption(a.id); toast(t.life.reopened); }} className="h-10 rounded-full bg-surface text-[13.5px] font-semibold">
                        {t.life.notWorked}
                      </ConfirmButton>
                    </div>
                  </div>
                )}
              </div>
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
            {(r.status === "sent" || r.status === "accepted") && a.status !== "adopted" && (
              <ConfirmButton onConfirm={() => { store.cancelRequest(r.id); toast(t.life.cancelled); }} className="h-9 shrink-0 rounded-full bg-surface-2 px-3 text-[12.5px] font-semibold text-label-2">
                {t.verify.cancel}
              </ConfirmButton>
            )}
            {r.status === "accepted" && a.status !== "adopted" && phone && (
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
            <div className="truncate text-[12.5px] text-label-2">{a.shelter.name} · {a.location.address}{a.ownerPhone && <> · <a href={`tel:${a.ownerPhone.replace(/\s/g, "")}`} className="font-semibold text-accent" dir="ltr">{a.ownerPhone}</a></>}</div>
          </div>
          <button type="button" onClick={() => store.moderateAdoption(a.id, "approved")} className="flex h-9 items-center gap-1.5 rounded-full bg-stable-soft px-3.5 text-[13px] font-semibold text-stable"><Check className="h-4 w-4" /> {t.admin.approve}</button>
          <button type="button" onClick={() => store.moderateAdoption(a.id, "rejected")} className="flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold text-label-2"><X className="h-4 w-4" /> {t.market.decline}</button>
        </div>
      ))}
    </section>
  );
}

/** Admin: changes to live listings (adoption or business), shown field by field. */
export function EditQueue() {
  const { t } = useI18n();
  const adoptions = useStore((s) => s.adoptions).filter((a) => a.pendingEdit);
  const services = useStore((s) => s.services).filter((s) => s.pendingEdit);
  const cases = useStore((s) => s.cases).filter((c) => c.pendingEdit);
  const show = (v: unknown): string =>
    Array.isArray(v) ? v.map((x) => (typeof x === "string" ? (x.startsWith("data:") ? "📷" : x) : (x as { name?: string }).name ?? "")).join(", ") : v && typeof v === "object" ? ((v as { address?: string }).address ?? "") : String(v ?? "");
  const label: Record<string, string> = {
    name: t.market.name, species: t.report.animalTitle, breed: t.market.breed, sex: t.adopt.sex.male + " / " + t.adopt.sex.female, ageMonths: t.market.age,
    photos: t.market.stepPhotos, healthStatus: t.market.health, vaccinations: t.market.vaccines, behavior: t.market.behavior, careNeeds: t.market.care,
    story: t.market.story, ownerPhone: t.market.phone, phone: t.acct.phone, location: t.market.city, description: t.biz.description, hours: t.biz.hours, conditionTags: t.report.situationTitle,
  };
  const rows = (cur: Record<string, unknown>, next: Record<string, unknown>) =>
    Object.keys(next)
      .filter((k) => k !== "at" && show(cur[k]) !== show(next[k]))
      .map((k) => (
        <div key={k} className="grid grid-cols-[90px_1fr] gap-2 text-[12.5px]">
          <span className="font-semibold text-label-2">{label[k] ?? k}</span>
          <span className="min-w-0">
            <span className="text-label-2 line-through">{show(cur[k]) || "—"}</span> → <span className="font-semibold">{show(next[k]) || "—"}</span>
          </span>
        </div>
      ));
  const total = adoptions.length + services.length + cases.length;
  return (
    <section className="card mb-5 overflow-hidden rounded-[28px]">
      <div className="flex items-center justify-between p-5">
        <h2 className="text-[19px] font-bold">{t.post.queue}</h2>
        <span className="rounded-full bg-monitor-soft px-3 py-1 text-[13px] font-semibold text-monitor">{total}</span>
      </div>
      {total === 0 && <div className="px-5 pb-5 text-[14px] text-label-2">{t.market.none}</div>}
      {[
        ...adoptions.map((a) => ({ id: a.id, name: a.name, kind: t.nav.adopt, cur: a as unknown as Record<string, unknown>, next: a.pendingEdit as Record<string, unknown>, ok: (v: boolean) => store.reviewAdoptionEdit(a.id, v) })),
        ...cases.map((c) => ({ id: c.id, name: c.title, kind: t.nav.report, cur: c as unknown as Record<string, unknown>, next: c.pendingEdit as Record<string, unknown>, ok: (v: boolean) => store.reviewCaseEdit(c.id, v) })),
        ...services.map((s) => ({ id: s.id, name: s.name, kind: t.common.service[s.type], cur: s as unknown as Record<string, unknown>, next: s.pendingEdit as Record<string, unknown>, ok: (v: boolean) => store.reviewServiceEdit(s.id, v) })),
      ].map((x) => (
        <div key={x.id} className="space-y-2 border-t border-separator px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 font-semibold">{x.name} · <span className="font-normal text-label-2">{x.kind}</span></div>
            <button type="button" onClick={() => x.ok(true)} className="flex h-9 items-center gap-1.5 rounded-full bg-stable-soft px-3.5 text-[13px] font-semibold text-stable"><Check className="h-4 w-4" /> {t.admin.approve}</button>
            <button type="button" onClick={() => x.ok(false)} className="flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold text-label-2"><X className="h-4 w-4" /> {t.market.decline}</button>
          </div>
          <div className="space-y-1 rounded-[14px] bg-surface-2 p-3">{rows(x.cur, x.next)}</div>
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
            <div className="truncate text-[12.5px] text-label-2">{s.location.address}{s.phone && <> · <a href={`tel:${s.phone.replace(/\s/g, "")}`} className="font-semibold text-accent" dir="ltr">{s.phone}</a></>}</div>
          </div>
          <button type="button" onClick={() => store.moderateService(s.id, true)} className="flex h-9 items-center gap-1.5 rounded-full bg-stable-soft px-3.5 text-[13px] font-semibold text-stable"><Check className="h-4 w-4" /> {t.admin.approve}</button>
          <button type="button" onClick={() => store.moderateService(s.id, false)} className="flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold text-label-2"><X className="h-4 w-4" /> {t.market.decline}</button>
        </div>
      ))}
    </section>
  );
}
