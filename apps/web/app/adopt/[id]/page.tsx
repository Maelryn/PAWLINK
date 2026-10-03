"use client";

import { motion } from "motion/react";
import { ArrowLeft, Check, Syringe, Heart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { TopNav } from "@/components/layout/TopNav";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Emoji3D } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import { store, useStore } from "@/lib/store";
import { useSession } from "@/lib/auth";
import { Segmented } from "@/components/ui/primitives";
import { AnimatePresence } from "motion/react";
import { MessageCircle, Phone } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { SPECIES_EMOJI } from "@/lib/species";

export default function AdoptionProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useI18n();
  const a = useStore((s) => s.adoptions).find((x) => x.id === id);
  const me = useSession();
  const router = useRouter();
  const myReq = useStore((s) => s.requests).find((r) => r.adoptionId === id && r.from.id === me?.id);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [housing, setHousing] = useState<"apartment" | "house" | "farm">("house");
  const [exp, setExp] = useState(true);
  if (!a) return null;
  const mine = !!me && a.ownerId === me.id;
  const phone = (a.ownerPhone ?? "").replace(/\s/g, "");

  const fmt = (d: string) => new Date(d).toLocaleDateString(locale === "ar" ? "ar-DZ" : locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="min-h-[100svh] pb-36">
      <TopNav />
      <div className="mx-auto max-w-[1080px] px-4 pt-24 sm:pt-28">
        <Link href="/adopt" className="glass mb-4 inline-flex h-10 items-center gap-1.5 rounded-full pe-4 ps-3 text-[14px] font-semibold">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t.nav.adopt}
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 22 }}
            className="relative h-[52svh] min-h-[380px] overflow-hidden rounded-[40px] lg:sticky lg:top-24 lg:h-[calc(100svh-140px)]"
          >
            <Image src={a.photos[0]} alt={a.name} fill priority unoptimized={a.photos[0].startsWith("data:")} sizes="600px" className="object-cover" />
            {a.photos.length > 1 && (
              <div className="absolute end-4 top-4 flex gap-1.5">
                {a.photos.slice(1).map((p, i) => (
                  <div key={i} className="relative h-14 w-14 overflow-hidden rounded-[14px] ring-2 ring-white/80">
                    <Image src={p} alt="" fill unoptimized={p.startsWith("data:")} sizes="56px" className="object-cover" />
                  </div>
                ))}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-0 p-7 text-white">
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="text-[52px] font-bold leading-none tracking-[-0.045em]">
                {a.name}
              </motion.div>
              <div className="mt-2 text-[16px] text-white/85">
                {a.breed} · {t.adopt.age(a.ageMonths)} · {t.adopt.sex[a.sex]}
              </div>
            </div>
          </motion.div>

          <div className="space-y-5">
            <Reveal>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { e: SPECIES_EMOJI[a.species], v: t.common.species[a.species] },
                  { e: "/3d/star.png", v: t.adopt.age(a.ageMonths) },
                  { e: a.sex === "male" ? "/3d/bone.png" : "/3d/heart.png", v: t.adopt.sex[a.sex] },
                ].map((x) => (
                  <div key={x.v} className="card flex flex-col items-center gap-2 rounded-[24px] py-4 text-[14px] font-semibold">
                    <Emoji3D src={x.e} size={36} />
                    {x.v}
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.05}>
              <section className="card rounded-[30px] p-6">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-label-2">{t.adopt.story}</h2>
                <p className="mt-2 text-[17px] leading-relaxed">{a.story}</p>
              </section>
            </Reveal>

            <Reveal delay={0.1}>
              <section className="card rounded-[30px] p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-[20px] font-bold tracking-[-0.02em]">{t.adopt.health}</h2>
                  <span className="rounded-full bg-stable-soft px-3 py-1 text-[13px] font-semibold text-stable">{a.healthStatus}</span>
                </div>
                <div className="mt-4 text-[13px] font-semibold text-label-2">{t.adopt.vaccines}</div>
                <div className="mt-2 space-y-2">
                  {a.vaccinations.map((v, i) => (
                    <motion.div
                      key={v.name}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-3 rounded-[16px] bg-surface-2 px-3.5 py-3"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stable text-white">
                        <Check className="h-4 w-4" strokeWidth={3} />
                      </span>
                      <span className="flex-1 text-[15px] font-semibold">{v.name}</span>
                      <span className="flex items-center gap-1 text-[13px] text-label-2">
                        <Syringe className="h-3.5 w-3.5" /> {fmt(v.date)}
                      </span>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-5 text-[13px] font-semibold text-label-2">{t.adopt.history}</div>
                <ol className="relative mt-3 space-y-4 border-s-2 border-separator ps-5">
                  {a.medicalHistory.map((m) => (
                    <li key={m.date} className="relative">
                      <span className="absolute -start-[27px] top-1 h-3 w-3 rounded-full bg-accent ring-4 ring-surface" />
                      <div className="text-[12.5px] text-label-2">{fmt(m.date)}</div>
                      <div className="text-[15px]">{m.note}</div>
                    </li>
                  ))}
                </ol>
              </section>
            </Reveal>

            <Reveal delay={0.15}>
              <section className="card grid gap-5 rounded-[30px] p-6 sm:grid-cols-2">
                <div>
                  <h2 className="text-[13px] font-semibold uppercase tracking-wide text-label-2">{t.adopt.behavior}</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.behavior.map((b) => (
                      <span key={b} className="rounded-full bg-accent-soft px-3 py-1.5 text-[13.5px] font-medium text-accent">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h2 className="text-[13px] font-semibold uppercase tracking-wide text-label-2">{t.adopt.care}</h2>
                  <ul className="mt-2 space-y-1.5 text-[14.5px]">
                    {a.careNeeds.map((c) => (
                      <li key={c} className="flex gap-2">
                        <span className="text-accent">•</span> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </Reveal>

            <Reveal delay={0.2}>
              <section className="card flex items-center gap-4 rounded-[30px] p-5">
                <Emoji3D src="/3d/home.png" size={48} />
                <div className="flex-1">
                  <div className="text-[12.5px] text-label-2">{t.adopt.shelter}</div>
                  <div className="text-[16px] font-semibold">{a.shelter.name}</div>
                  <div className="text-[13px] text-label-2">{a.location.address}</div>
                </div>
              </section>
            </Reveal>
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-[88px] z-40 flex justify-center px-4 md:bottom-6">
        <motion.div initial={{ y: 80 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 220, damping: 24, delay: 0.4 }} className="pointer-events-auto glass-strong w-full max-w-[480px] rounded-[30px] p-2">
          <AnimatePresence mode="wait" initial={false}>
            {mine ? (
              <motion.div key="mine" className="px-4 py-3 text-center text-[14px] font-semibold">
                {t.market.ownListing} · {a.status === "approved" ? t.market.approved : a.status === "pending" ? t.market.pending : t.market.rejected}
              </motion.div>
            ) : myReq ? (
              <motion.div key="req" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 p-2">
                <div className="flex items-center justify-between px-2 text-[14px]">
                  <span className="text-label-2">{t.market.yourRequest}</span>
                  <span className={cn("font-semibold", myReq.status === "accepted" ? "text-stable" : myReq.status === "declined" ? "text-urgent" : "text-monitor")}>{t.market.status[myReq.status]}</span>
                </div>
                {myReq.status === "accepted" && phone && (
                  <div className="flex gap-2">
                    <ButtonLink href={`tel:${phone}`} className="flex-1"><Phone className="h-4 w-4" /> {t.common.call}</ButtonLink>
                    <ButtonLink href={`https://wa.me/${phone.replace("+", "")}`} variant="tinted" className="flex-1"><MessageCircle className="h-4 w-4" /> {t.market.whatsapp}</ButtonLink>
                  </div>
                )}
              </motion.div>
            ) : open ? (
              <motion.form
                key="form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-3 overflow-hidden p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  store.sendRequest({ id: `rq${Date.now()}`, adoptionId: a.id, from: { id: me!.id, name: me!.name, avatar: "" }, message: msg, housing, experience: exp, status: "sent", createdAt: new Date().toISOString() });
                  toast.success(t.market.sent, { icon: <Emoji3D src="/3d/love.png" size={22} /> });
                }}
              >
                <div className="text-[17px] font-bold">{t.market.requestTitle}</div>
                <p className="text-[13px] text-label-2">{t.market.requestBody}</p>
                <textarea required rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t.market.message} className="w-full resize-none rounded-[16px] bg-surface-2 p-3 text-[14.5px] outline-none" />
                <Segmented layoutId="housing-seg" className="w-full [&>button]:flex-1 [&>button]:px-1" value={housing} onChange={setHousing} options={(["apartment", "house", "farm"] as const).map((h) => ({ value: h, label: t.market.housing[h] }))} />
                <label className="flex items-center gap-2 text-[14px]">
                  <input type="checkbox" checked={exp} onChange={(e) => setExp(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" /> {t.market.experience}
                </label>
                <p className="text-[12px] text-label-2">🛡️ {t.market.safety}</p>
                <div className="flex gap-2">
                  <Button type="button" variant="glass" onClick={() => setOpen(false)}>{t.common.close}</Button>
                  <Button type="submit" className="flex-1">{t.market.send}</Button>
                </div>
              </motion.form>
            ) : (
              <motion.div key="cta" className="flex items-center gap-3 ps-4">
                <span className="flex-1 truncate text-[15px] font-semibold">{a.name} · {a.shelter.name}</span>
                <Button onClick={() => (me ? setOpen(true) : router.push(`/login?next=/adopt/${a.id}`))}>
                  <Heart className="h-[18px] w-[18px] fill-current" /> {t.adopt.cta}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
