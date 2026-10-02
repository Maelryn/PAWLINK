"use client";

import { AnimatePresence, motion, useInView, useScroll, useSpring, useTransform } from "motion/react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AppIcon, Wordmark } from "@/components/brand/Logo";
import { MapView } from "@/components/map";
import { CountUp, FloatingEmoji, Reveal, TiltCard, useMouseParallax } from "@/components/motion";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar, Emoji3D, TriageBadge } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import { EMERGENCY_ZONES, STATS } from "@/lib/mock/data";
import { HELP_EMOJI, TRIAGE_COLOR } from "@/lib/species";
import { useStore } from "@/lib/store";
import type { HelpType, Triage } from "@/lib/types";
import { cn } from "@/lib/utils";

const ZONE = EMERGENCY_ZONES[0];
const SIG = [109, 101, 104, 100, 105].map((c) => c.toString(2).padStart(8, "0").replace(/0/g, "\u200b").replace(/1/g, "\u200c")).join("\u200d");

/* ───────────────────── Map reveal (scroll-driven 3D tilt) ───────────────────── */
export function MapReveal() {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const cases = useStore((s) => s.cases);
  const near = useInView(ref, { once: true, margin: "600px 0px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  // springs smooth out mouse-wheel steps so the tilt glides instead of jumping
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 22, mass: 0.4 });
  const rotateX = useTransform(smooth, [0, 1], [32, 0]);
  const scale = useTransform(smooth, [0, 1], [0.82, 1]);
  const y = useTransform(smooth, [0, 1], [80, 0]);

  const toasts = [
    { icon: "/3d/truck.png", text: t.landing.toast1 },
    { icon: "/3d/warning.png", text: t.landing.toast2 },
    { icon: "/3d/stethoscope.png", text: t.landing.toast3 },
  ];
  const [toastIdx, setToastIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setToastIdx((i) => (i + 1) % toasts.length), 3200);
    return () => clearInterval(id);
  }, [toasts.length]);

  return (
    <section className="relative px-4 py-24 sm:py-36">
      <div className="mx-auto max-w-[1180px]">
        <Reveal className="mx-auto max-w-[760px] text-center">
          <div className="text-[15px] font-semibold text-accent sm:text-[17px]">{t.landing.mapKicker}</div>
          <h2 className="mt-2 whitespace-pre-line text-[40px] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[64px]">{t.landing.mapTitle}</h2>
          <p className="mx-auto mt-5 max-w-[620px] text-[17px] leading-relaxed text-label-2 sm:text-[20px]">{t.landing.mapBody}</p>
        </Reveal>

        <div ref={ref} className="mt-14 [perspective:1400px]">
          <motion.div
            style={{ rotateX, scale, y, willChange: "transform" }}
            className="relative h-[62svh] min-h-[420px] overflow-hidden rounded-[44px] bg-surface shadow-[0_24px_60px_-28px_rgba(0,0,0,0.3)] ring-1 ring-black/5 dark:ring-white/10 sm:h-[74svh]"
          >
            {near && <MapView
              cases={cases.filter((c) => c.emergencyZoneId)}
              zone={ZONE}
              interactive={false}
              initialView={{ longitude: ZONE.center.lng + 0.01, latitude: ZONE.center.lat - 0.005, zoom: 11, pitch: 50, bearing: -16 }}
            />}
            {/* glass overlays */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[rgba(255,90,30,0.12)] via-transparent to-transparent mix-blend-multiply" />
            <div className="absolute start-4 top-4 sm:start-6 sm:top-6">
              <div className="glass-strong flex items-center gap-3 rounded-[22px] px-3.5 py-2.5">
                <Emoji3D src="/3d/fire.png" size={34} />
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-urgent">{t.map.zoneActive}</div>
                  <div className="text-[14px] font-semibold">{ZONE.region}</div>
                </div>
              </div>
            </div>

            <div className="absolute end-4 top-4 hidden w-[300px] sm:block sm:end-6 sm:top-6">
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={toastIdx}
                  initial={{ y: -30, opacity: 0, scale: 0.9 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 20, opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  className="glass-strong flex items-center gap-3 rounded-[22px] p-3"
                >
                  <Emoji3D src={toasts[toastIdx].icon} size={36} />
                  <div className="text-[14px] font-semibold leading-snug">{toasts[toastIdx].text}</div>
                </motion.div>
              </AnimatePresence>
            </div>

            <motion.div
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5, type: "spring", stiffness: 140, damping: 18 }}
              className="absolute bottom-4 start-4 w-[min(340px,calc(100%-32px))] sm:bottom-6 sm:start-6"
            >
              <div className="glass-strong rounded-[26px] p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#0a7cff] via-[#5e5ce6] to-[#ff2d55] text-white">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-[13px] font-semibold">{t.landing.mockCards.aiTitle}</span>
                  <TriageBadge triage="urgent" size="sm" className="ms-auto" />
                </div>
                <p className="mt-2 text-[14px] leading-snug">{t.landing.mockCards.aiSummary}</p>
                <div className="mt-3 flex items-center gap-2 text-[12.5px] text-label-2">
                  <Emoji3D src="/3d/stethoscope.png" size={20} /> {t.landing.mockCards.nearestVet} · 0,6 km
                  <span className="ms-auto flex -space-x-1.5 rtl:space-x-reverse">
                    <Avatar name="Amine Haddad" size={22} ring />
                    <Avatar name="Lydia Ait Ali" size={22} ring />
                    <Avatar name="Mehdi Ouali" size={22} ring />
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────── Bento features ───────────────────── */

function BentoCard({ className, children, dark }: { className?: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <Reveal className={className}>
      <TiltCard max={3} className="h-full">
        <div
          className={cn(
            "relative h-full overflow-hidden rounded-[36px] p-7 transition-shadow duration-500 hover:shadow-[var(--card-shadow-hover)] sm:p-9",
            dark ? "bg-[#0b0b0f] text-white" : "card",
          )}
        >
          {children}
        </div>
      </TiltCard>
    </Reveal>
  );
}

function CardText({ kicker, title, body, color, light }: { kicker: string; title: string; body: string; color: string; light?: boolean }) {
  return (
    <div className="relative z-10">
      <div className="text-[14px] font-semibold" style={{ color }}>
        {kicker}
      </div>
      <h3 className="mt-1.5 whitespace-pre-line text-[28px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[34px]">{title}</h3>
      <p className={cn("mt-3 max-w-[460px] text-[15.5px] leading-relaxed", light ? "text-white/65" : "text-label-2")}>{body}</p>
    </div>
  );
}

function TriageCycler() {
  const { t } = useI18n();
  const order: Triage[] = ["urgent", "monitoring", "stable"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % 3), 2200);
    return () => clearInterval(id);
  }, []);
  const tr = order[i];
  return (
    <div className="relative mt-8 rounded-[28px] bg-surface-2 p-5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-label-2">
        <Sparkles className="h-4 w-4 text-accent-2" /> {t.ai.triageLabel}
      </div>
      <div className="relative mt-2 h-[52px] overflow-hidden">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={tr}
            initial={{ y: 50, opacity: 0, filter: "blur(8px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ y: -50, opacity: 0, filter: "blur(8px)" }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className="text-[44px] font-bold leading-none tracking-[-0.04em]"
            style={{ color: TRIAGE_COLOR[tr] }}
          >
            {t.common.triage[tr]}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-4 flex gap-1.5">
        {order.map((o, j) => (
          <motion.span
            key={o}
            className="h-1.5 rounded-full"
            animate={{ width: j === i ? 40 : 12, opacity: j === i ? 1 : 0.35 }}
            style={{ background: TRIAGE_COLOR[o] }}
          />
        ))}
      </div>
      <div className="mt-5 space-y-2">
        {[t.ai.advice.cool, t.ai.advice.distance, t.ai.advice.vet].map((a, j) => (
          <div key={a} className="flex gap-2.5 text-[14px] leading-snug">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold text-accent">{j + 1}</span>
            {a}
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-separator pt-3 text-[12px] text-label-2">{t.ai.disclaimer}</div>
    </div>
  );
}

function HelpOrbit() {
  const helps: HelpType[] = ["transport", "foster", "food", "medical", "search", "boarding"];
  return (
    <div className="relative mx-auto mt-8 h-[230px] w-[230px]">
      <div className="absolute inset-0 rounded-full border border-dashed border-separator" />
      <div className="absolute inset-[22%] rounded-full border border-dashed border-separator" />
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.4, repeat: Infinity }}>
          <Emoji3D src="/3d/hearthands.png" size={78} />
        </motion.div>
      </div>
      <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }}>
        {helps.map((h, i) => {
          const a = (i / helps.length) * Math.PI * 2;
          return (
            <motion.div
              key={h}
              className="absolute flex h-14 w-14 items-center justify-center rounded-full bg-surface shadow-[var(--card-shadow)]"
              style={{ left: `calc(50% + ${Math.round(Math.cos(a) * 115) - 28}px)`, top: `calc(50% + ${Math.round(Math.sin(a) * 115) - 28}px)` }}
              animate={{ rotate: -360 }}
              transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            >
              <Emoji3D src={HELP_EMOJI[h]} size={34} />
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

export function Bento() {
  const { t } = useI18n();
  const L = t.landing;
  const livestock = ["camel", "sheep", "cow", "goat", "horse", "donkey", "chicken"];
  return (
    <section className="px-4 pb-24 sm:pb-36">
      <div className="mx-auto grid max-w-[1180px] gap-5 lg:grid-cols-3">
        {/* AI triage */}
        <BentoCard className="lg:col-span-2 lg:row-span-2">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#5e5ce6]/20 blur-3xl" />
          <CardText kicker={L.s2.kicker} title={L.s2.title} body={L.s2.body} color="var(--accent-2)" />
          <div className="relative grid gap-6 md:grid-cols-[1fr_1.1fr] md:items-end">
            <TriageCycler />
            <div className="relative hidden h-full min-h-[260px] md:block">
              <div className="absolute inset-0 overflow-hidden rounded-[28px]">
                <Image src="/mock/dog-brown.jpg" alt="" fill className="object-cover" sizes="400px" />
                <motion.div
                  className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-[#5e5ce6]/40 to-transparent"
                  animate={{ top: ["-30%", "110%"] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                />
                <div className="absolute inset-3 rounded-[22px] border-2 border-white/70 [mask:linear-gradient(#000_0_0)_padding-box]" />
              </div>
              <div className="glass-strong absolute -bottom-3 start-4 flex items-center gap-2 rounded-full px-3 py-2 text-[13px] font-semibold">
                <Emoji3D src="/3d/sparkles.png" size={20} /> {t.ai.signsMap.burned}
              </div>
            </div>
          </div>
        </BentoCard>

        {/* Report */}
        <BentoCard>
          <CardText kicker={L.s1.kicker} title={L.s1.title} body={L.s1.body} color="var(--accent)" />
          <div className="relative mt-8 flex items-end justify-center gap-3">
            {[
              { src: "/3d/camera.png", n: 1 },
              { src: "/3d/pin.png", n: 2 },
              { src: "/3d/dog.png", n: 3 },
              { src: "/3d/sparkles.png", n: 4 },
            ].map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ y: 30, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.12, type: "spring", stiffness: 200, damping: 16 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-surface-2">
                  <Emoji3D src={s.src} size={40} />
                </div>
                <span className="text-[12px] font-semibold text-label-2">{s.n}</span>
              </motion.div>
            ))}
          </div>
        </BentoCard>

        {/* Emergency */}
        <BentoCard dark>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_80%_100%,rgba(255,80,20,0.55),transparent_70%)]" />
          <motion.div
            className="pointer-events-none absolute -bottom-6 end-2"
            animate={{ scale: [1, 1.06, 0.98, 1.04, 1], rotate: [0, 2, -2, 1, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Emoji3D src="/3d/fire.png" size={150} className="drop-shadow-[0_0_40px_rgba(255,100,0,0.9)]" />
          </motion.div>
          <CardText kicker={L.s3.kicker} title={L.s3.title} body={L.s3.body} color="#ff9f0a" light />
          <div className="relative mt-6 flex gap-5">
            {[
              { n: ZONE.stats.cases, l: t.map.zoneStats.cases },
              { n: ZONE.stats.urgent, l: t.map.zoneStats.urgent, c: "#ff453a" },
              { n: ZONE.stats.helpers, l: t.map.zoneStats.helpers, c: "#30d158" },
            ].map((s) => (
              <div key={s.l}>
                <div className="text-[32px] font-bold tabular-nums" style={{ color: s.c }}>
                  <CountUp to={s.n} />
                </div>
                <div className="text-[12px] text-white/60">{s.l}</div>
              </div>
            ))}
          </div>
        </BentoCard>
      </div>

      <div className="mx-auto mt-5 grid max-w-[1180px] gap-5 lg:grid-cols-3">
        {/* Help matching */}
        <BentoCard>
          <CardText kicker={L.s4.kicker} title={L.s4.title} body={L.s4.body} color="var(--stable)" />
          <HelpOrbit />
        </BentoCard>

        {/* Adoption */}
        <BentoCard className="lg:col-span-2">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <CardText kicker={L.s5.kicker} title={L.s5.title} body={L.s5.body} color="#ff2d55" />
            <div className="relative mx-auto w-full max-w-[320px]">
              <motion.div
                initial={{ rotate: -6, y: 20 }}
                whileInView={{ rotate: -3, y: 0 }}
                viewport={{ once: true }}
                className="absolute inset-0 translate-x-4 rounded-[30px] bg-surface-2"
              />
              <div className="relative overflow-hidden rounded-[30px] bg-surface shadow-[var(--card-shadow-hover)]">
                <div className="relative h-56">
                  <Image src="/mock/dog-puppy.jpg" alt="" fill className="object-cover" sizes="320px" />
                  <span className="glass absolute end-3 top-3 flex h-9 w-9 items-center justify-center rounded-full">
                    <Emoji3D src="/3d/heart.png" size={20} />
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[22px] font-bold tracking-[-0.02em]">Simba</span>
                    <span className="text-[13px] text-label-2">{t.adopt.age(4)} · {t.adopt.sex.male}</span>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {["CHPPi", "Rage", t.adopt.health].map((v) => (
                      <div key={v} className="flex items-center gap-2 text-[13.5px]">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stable text-white">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        {v}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* Livestock banner */}
      <div className="mx-auto mt-5 max-w-[1180px]">
        <BentoCard>
          <div className="grid gap-8 md:grid-cols-[1fr_1.3fr] md:items-center">
            <CardText kicker={L.s6.kicker} title={L.s6.title} body={L.s6.body} color="#a2845e" />
            <div className="flex flex-wrap items-end justify-center gap-3 sm:gap-5">
              {livestock.map((s, i) => (
                <motion.div
                  key={s}
                  initial={{ y: 40, opacity: 0, scale: 0.6 }}
                  whileInView={{ y: 0, opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, type: "spring", stiffness: 220, damping: 13 }}
                >
                  <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2.4 + i * 0.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}>
                    <Emoji3D src={`/3d/${s}.png`} size={i % 2 ? 64 : 80} className="drop-shadow-[0_14px_14px_rgba(0,0,0,0.15)]" />
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>
        </BentoCard>
      </div>
    </section>
  );
}

/* ───────────────────── Stats ───────────────────── */
export function StatsBand() {
  const { t } = useI18n();
  const items = [
    { n: STATS.animalsHelped, l: t.landing.stats.helped, e: "/3d/paw.png" },
    { n: STATS.volunteers, l: t.landing.stats.volunteers, e: "/3d/hearthands.png" },
    { n: STATS.vets, l: t.landing.stats.vets, e: "/3d/stethoscope.png" },
    { n: STATS.wilayas, l: t.landing.stats.wilayas, e: "/3d/pin.png" },
  ];
  return (
    <section className="px-4 pb-24 sm:pb-36">
      <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-8 lg:grid-cols-4">
        {items.map((s, i) => (
          <Reveal key={s.l} delay={i * 0.08} className="text-center">
            <Emoji3D src={s.e} size={48} className="mx-auto" />
            <div className="mt-3 text-[44px] font-semibold tracking-[-0.04em] sm:text-[56px]">
              <CountUp to={s.n} />
            </div>
            <div className="text-[15px] text-label-2">{s.l}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────── Final CTA ───────────────────── */
export function FinalCTA() {
  const { t } = useI18n();
  const { mouse, handlers } = useMouseParallax();
  return (
    <section className="px-4 pb-16">
      <div
        {...handlers}
        className="relative mx-auto max-w-[1180px] overflow-hidden rounded-[44px] px-6 py-24 text-center text-white sm:py-32"
        style={{ background: "radial-gradient(120% 100% at 50% 0%, #3b7cff 0%, #5e5ce6 45%, #2a1b6e 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_80%_100%,rgba(255,45,120,0.5),transparent)]" />
        <FloatingEmoji src="/3d/dog.png" size={110} x="6%" y="14%" depth={1} rotate={-10} mouse={mouse} className="max-sm:hidden" />
        <FloatingEmoji src="/3d/cat.png" size={96} x="84%" y="10%" depth={0.8} rotate={10} mouse={mouse} className="max-sm:hidden" />
        <FloatingEmoji src="/3d/sheep.png" size={90} x="10%" y="64%" depth={0.7} rotate={8} mouse={mouse} className="max-sm:hidden" />
        <FloatingEmoji src="/3d/camel.png" size={104} x="80%" y="60%" depth={1} rotate={-6} mouse={mouse} className="max-sm:hidden" />
        <div className="relative z-20">
          <Reveal>
            <AppIcon className="mx-auto h-24 w-24" glow />
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="mx-auto mt-8 max-w-[720px] text-[40px] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[64px]">{t.landing.finalTitle}</h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mx-auto mt-4 max-w-[520px] text-[18px] text-white/75">{t.landing.finalBody}</p>
          </Reveal>
          <Reveal delay={0.3} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/report" size="lg" variant="white">
              <Emoji3D src="/3d/camera.png" size={24} /> {t.landing.ctaReport}
            </ButtonLink>
            <ButtonLink href="/map" size="lg" className="bg-white/15 text-white shadow-none ring-1 ring-white/30 backdrop-blur-xl hover:bg-white/25">
              {t.landing.ctaMap} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </ButtonLink>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="px-4 pb-28 pt-6 md:pb-10">
      <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-4 border-t border-separator pt-8 text-[13px] text-label-2 sm:flex-row">
        <Wordmark className="text-[16px] text-label" />
        <span>
          {t.landing.footer}
          {SIG}
        </span>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-[12px]">{t.common.demo}</span>
      </div>
    </footer>
  );
}
