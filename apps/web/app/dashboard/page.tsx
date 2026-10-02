"use client";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { CaseRow } from "@/components/cases/CaseBits";
import { TopNav } from "@/components/layout/TopNav";
import { CountUp, Reveal } from "@/components/motion";
import { Avatar, CasePhoto, Emoji3D, TimeAgo, TriageBadge } from "@/components/ui/primitives";
import { useCaseAI } from "@/lib/ai/useCaseAI";
import { useI18n } from "@/lib/i18n";
import { HELP_EMOJI, SPECIES_EMOJI, TRIAGE_ORDER } from "@/lib/species";
import { useSession } from "@/lib/auth";
import { MyAdoptions } from "@/components/adopt/AdoptionPanels";
import { isPublic, useStore } from "@/lib/store";
import type { Case, HelpType } from "@/lib/types";
import { cn, distanceKm } from "@/lib/utils";

const DEFAULT_HOME = { lat: 36.66, lng: 4.12 };

export default function Page() {
  return (
    <RequireAuth area="dashboard">
      <DashboardPage />
    </RequireAuth>
  );
}

function DashboardPage() {
  const { t } = useI18n();
  const me = useSession()!;
  const cases = useStore((s) => s.cases);
  const HOME = me.location ?? DEFAULT_HOME;
  const [skills, setSkills] = useState<HelpType[]>(me.helpTypes ?? ["transport"]);
  const [available, setAvailable] = useState(true);

  const open = cases.filter((c) => c.status !== "resolved" && isPublic(c));
  const near = open
    .map((c) => ({ c, d: distanceKm(HOME, c.location) }))
    .sort((a, b) => TRIAGE_ORDER[a.c.triage] - TRIAGE_ORDER[b.c.triage] || a.d - b.d);
  const mine = cases.filter((c) => c.reporter.id === me.id || c.helpers.some((h) => h.user.id === me.id));
  const vetQueue = near.filter((x) => x.c.triage === "urgent");


  return (
    <div className="min-h-[100svh] overflow-x-clip pb-32">
      <TopNav />
      <div className="mx-auto max-w-[1180px] px-4 pt-28 sm:pt-32">
        <Reveal className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="flex items-center gap-4">
            <Avatar name={me.name} size={64} />
            <div>
              <div className="text-[14px] font-semibold text-accent">{t.dashboard.roles[me.role]}</div>
              <h1 className="text-[28px] font-bold leading-tight tracking-[-0.04em] sm:text-[44px]">{t.dashboard.hello(me.name)}</h1>
              <p className="text-[15px] text-label-2">{t.dashboard.subtitle}</p>
            </div>
          </div>
        </Reveal>

        {/* impact */}
        <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4">
          {[
            { e: "/3d/paw.png", n: me.role === "vet" ? 214 : me.role === "reporter" ? 12 : 47, l: t.dashboard.rescued },
            { e: "/3d/hearthands.png", n: me.role === "vet" ? 380 : me.role === "reporter" ? 6 : 96, l: t.dashboard.hours },
            { e: "/3d/star.png", n: Math.round((me.rating ?? 4.8) * 10), l: t.dashboard.rating, f: (v: number) => (v / 10).toFixed(1) },
          ].map((s, i) => (
            <Reveal key={s.l} delay={i * 0.06}>
              <div className="card flex min-w-0 flex-col items-start gap-2 rounded-[24px] p-3.5 sm:flex-row sm:items-center sm:gap-3 sm:rounded-[28px] sm:p-5">
                <Emoji3D src={s.e} size={44} />
                <div>
                  <div className="text-[24px] font-bold leading-none tracking-[-0.03em] sm:text-[30px]">
                    <CountUp to={s.n} format={s.f} />
                  </div>
                  <div className="mt-1 text-[12px] leading-tight text-label-2 sm:text-[13px]">{s.l}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <Reveal>
              <section>
                <div className="mb-3 flex items-end justify-between">
                  <h2 className="text-[22px] font-bold tracking-[-0.02em]">{me.role === "vet" ? `${t.common.triage.urgent} · ${t.dashboard.near}` : t.dashboard.near}</h2>
                  <Link href="/map" className="text-[14px] font-semibold text-accent">
                    {t.common.seeAll}
                  </Link>
                </div>
                <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 no-scrollbar">
                  {(me.role === "vet" ? vetQueue : near).slice(0, 8).map(({ c, d }, i) => (
                    <NearCard key={c.id} c={c} d={d} i={i} />
                  ))}
                </div>
              </section>
            </Reveal>

            <Reveal>
              <MyAdoptions me={me} />
            </Reveal>

            <Reveal>
              <section className="card rounded-[32px] p-3">
                <h2 className="px-3 pb-1 pt-3 text-[20px] font-bold tracking-[-0.02em]">{t.dashboard.mine}</h2>
                {mine.length === 0 && <div className="p-6 text-center text-label-2">—</div>}
                {mine.map((c) => (
                  <Link key={c.id} href={`/cases/${c.id}`}>
                    <CaseRow c={c} distance={distanceKm(HOME, c.location)} />
                  </Link>
                ))}
              </section>
            </Reveal>
          </div>

          <Reveal>
            <section className="card rounded-[32px] p-6 lg:sticky lg:top-24">
              <div className="flex items-center justify-between">
                <h2 className="text-[20px] font-bold tracking-[-0.02em]">{t.dashboard.skills}</h2>
              </div>
              <button
                type="button"
                onClick={() => setAvailable((v) => !v)}
                className={cn("mt-4 flex w-full items-center gap-3 rounded-[20px] p-3.5 transition-colors", available ? "bg-stable-soft" : "bg-surface-2")}
              >
                <span className="relative flex h-3 w-3">
                  {available && <span className="pulse-ring absolute inset-0 rounded-full bg-stable" />}
                  <span className={cn("relative h-3 w-3 rounded-full", available ? "bg-stable" : "bg-label-3")} />
                </span>
                <span className="flex-1 text-start text-[15px] font-semibold">{t.dashboard.available}</span>
                <span className={cn("relative h-[31px] w-[51px] rounded-full p-[2px] transition-colors", available ? "bg-stable" : "bg-label-3/50")}>
                  <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 34 }} className={cn("block h-[27px] w-[27px] rounded-full bg-white shadow", available && "ms-auto")} />
                </span>
              </button>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {(Object.keys(HELP_EMOJI) as HelpType[]).map((h) => {
                  const on = skills.includes(h);
                  return (
                    <motion.button
                      key={h}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSkills(on ? skills.filter((x) => x !== h) : [...skills, h])}
                      className={cn("flex items-center gap-2 rounded-[18px] border p-2.5 text-[13.5px] font-semibold transition-colors", on ? "border-accent bg-accent-soft text-accent" : "border-separator")}
                    >
                      <Emoji3D src={HELP_EMOJI[h]} size={26} />
                      {t.common.help[h]}
                    </motion.button>
                  );
                })}
              </div>
            </section>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function NearCard({ c, d, i }: { c: Case; d: number; i: number }) {
  const { t } = useI18n();
  const ai = useCaseAI(c);
  return (
    <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05, type: "spring", stiffness: 240, damping: 26 }} className="w-[280px] shrink-0 snap-start">
      <Link href={`/cases/${c.id}`} className="card group block overflow-hidden rounded-[28px] transition-shadow hover:shadow-[var(--card-shadow-hover)]">
        <div className="relative h-40">
          <CasePhoto photo={c.photos[0]} emoji={SPECIES_EMOJI[c.species]} emojiSize={80} sizes="280px" className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
          <TriageBadge triage={c.triage} className="glass absolute start-3 top-3" />
          <span className="glass absolute end-3 top-3 rounded-full px-2.5 py-1 text-[12px] font-semibold">{t.common.km(d)}</span>
        </div>
        <div className="p-4">
          <div className="truncate text-[16px] font-semibold">{c.title}</div>
          <div className="mt-0.5 text-[12.5px] text-label-2">
            {c.location.address} · <TimeAgo iso={c.createdAt} />
          </div>
          {ai && (
            <div className="mt-3 flex flex-wrap gap-1">
              {ai.recommendedHelp.slice(0, 3).map((h) => (
                <span key={h} className="flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pe-2 ps-1 text-[11.5px] font-medium">
                  <Emoji3D src={HELP_EMOJI[h]} size={16} /> {t.common.help[h]}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
