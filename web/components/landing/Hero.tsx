"use client";

import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { MARK_PATH, TOES } from "@/components/brand/Logo";
import { FloatingEmoji, SplitWords, useMouseParallax } from "@/components/motion";
import { ButtonLink } from "@/components/ui/Button";
import { Emoji3D } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import { EMERGENCY_ZONES } from "@/lib/mock/data";
import { useStore } from "@/lib/store";

const CAST = [
  // src, size, x, y, depth, blur, rotate
  { src: "/3d/dog.png", s: 150, x: "14%", y: "9%", d: 1.2, b: 0, r: -8 },
  { src: "/3d/cat.png", s: 132, x: "72%", y: "7%", d: 1.1, b: 0, r: 8 },
  { src: "/3d/sheep.png", s: 118, x: "5%", y: "47%", d: 0.9, b: 0, r: -6 },
  { src: "/3d/camel.png", s: 128, x: "82%", y: "42%", d: 1, b: 0, r: 6 },
  { src: "/3d/goat.png", s: 96, x: "13%", y: "70%", d: 0.8, b: 0.5, r: 10 },
  { src: "/3d/horse.png", s: 112, x: "78%", y: "68%", d: 0.9, b: 0, r: -8 },
  { src: "/3d/owl.png", s: 64, x: "41%", y: "4%", d: 0.5, b: 1.2, r: 0 },
  { src: "/3d/chick.png", s: 58, x: "88%", y: "90%", d: 0.5, b: 1.5, r: 0 },
  { src: "/3d/heart.png", s: 54, x: "31%", y: "33%", d: 0.6, b: 0.8, r: -12 },
  { src: "/3d/stethoscope.png", s: 58, x: "64%", y: "28%", d: 0.6, b: 0.8, r: 12 },
  { src: "/3d/fire.png", s: 240, x: "-7%", y: "16%", d: 0.25, b: 16, r: 0 },
  { src: "/3d/cow.png", s: 220, x: "91%", y: "-6%", d: 0.25, b: 14, r: 0 },
  { src: "/3d/home.png", s: 200, x: "92%", y: "74%", d: 0.25, b: 16, r: 0 },
];

function useCompact() {
  const [k, setK] = useState(1);
  useEffect(() => {
    const f = () => setK(window.innerWidth < 640 ? 0.52 : window.innerWidth < 1024 ? 0.72 : 1);
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return k;
}

/** The PawLink mark rendered inside a frosted glass tile, like the iOS 16 "16" tile. */
function GlassTile() {
  const uid = useId().replace(/:/g, "");
  return (
    <div className="relative">
      <div className="absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgba(94,92,230,0.35),rgba(255,45,85,0.18)_45%,transparent_70%)] blur-2xl" />
      <div className="glass glass-sheen relative flex h-[190px] w-[190px] items-center justify-center rounded-[54px] sm:h-[230px] sm:w-[230px] sm:rounded-[64px]">
        <svg viewBox="0 0 100 100" className="h-[62%] w-[62%] drop-shadow-[0_10px_20px_rgba(70,60,220,0.35)]">
          <defs>
            <linearGradient id={`g${uid}`} x1="0.1" y1="0" x2="0.9" y2="1">
              <stop offset="0" stopColor="#2f8cff" />
              <stop offset="0.55" stopColor="#5e5ce6" />
              <stop offset="1" stopColor="#ff2d78" />
            </linearGradient>
          </defs>
          <g fill={`url(#g${uid})`}>
            <path d={MARK_PATH} fillRule="evenodd" />
            {TOES.map((t, i) => (
              <motion.ellipse
                key={i}
                cx={t.cx}
                cy={t.cy}
                rx={t.rx}
                ry={t.ry}
                transform={`rotate(${t.rot} ${t.cx} ${t.cy})`}
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.5 + i * 0.08 }}
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

export function Hero() {
  const { t } = useI18n();
  const { mouse, handlers } = useMouseParallax();
  const k = useCompact();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useSpring(useTransform(scrollYProgress, [0, 1], [0, 160]), { stiffness: 120, damping: 24 });
  // cast drifts away early; the text + buttons stay readable until the section is almost gone
  const castFade = useTransform(scrollYProgress, [0.1, 0.75], [1, 0]);
  const fade = useTransform(scrollYProgress, [0.55, 0.95], [1, 0]);
  const scale = useTransform(scrollYProgress, [0.4, 1], [1, 0.96]);
  const cases = useStore((s) => s.cases);
  const urgent = cases.filter((c) => c.emergencyZoneId && c.triage === "urgent").length;

  return (
    <section ref={ref} {...handlers} className="relative isolate min-h-[100svh] overflow-hidden pb-24 pt-28 sm:pt-32">
      {/* ambient color fields */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {/* soft color fields: plain radial gradients (no blur filter = no repaint cost) */}
        <div className="absolute inset-0 bg-[radial-gradient(45vmax_40vmax_at_10%_20%,rgba(94,168,255,0.28),transparent_70%),radial-gradient(40vmax_36vmax_at_92%_50%,rgba(255,107,154,0.2),transparent_70%),radial-gradient(40vmax_30vmax_at_45%_105%,rgba(126,224,176,0.2),transparent_70%)] dark:opacity-60 [mask-image:linear-gradient(to_bottom,#000_60%,transparent)]" />
      </div>

      {/* floating 3D cast */}
      <motion.div style={{ y, opacity: castFade }} className="pointer-events-none absolute inset-x-0 top-16 h-[78svh] sm:top-20">
        {CAST.map((c, i) => (
          <FloatingEmoji
            key={c.src + i}
            src={c.src}
            size={Math.round(c.s * k)}
            x={c.x}
            y={c.y}
            depth={c.d}
            blur={c.b}
            rotate={c.r}
            delay={i * 0.07}
            mouse={mouse}
            className={i >= 6 && k < 0.6 && c.b < 10 ? "hidden" : undefined}
          />
        ))}
      </motion.div>

      <motion.div style={{ scale, opacity: fade }} className="relative z-20 mx-auto flex max-w-[980px] flex-col items-center px-5 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.6, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 120, damping: 16, delay: 0.1 }}>
          <GlassTile />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-10 text-[15px] font-medium text-label-2 sm:text-[17px]"
        >
          {t.landing.eyebrow}
        </motion.div>

        <h1 className="mt-3 text-[46px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[76px] lg:text-[92px]">
          <SplitWords text={t.landing.title1} delay={0.55} />
          <br />
          <SplitWords text={t.landing.title2} delay={0.75} className="text-gradient" />
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 max-w-[640px] text-balance text-[17px] leading-relaxed text-label-2 sm:text-[21px]"
        >
          {t.landing.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.25, type: "spring", stiffness: 160, damping: 18 }}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <ButtonLink href="/report" size="lg">
            <Emoji3D src="/3d/camera.png" size={24} />
            {t.landing.ctaReport}
          </ButtonLink>
          <ButtonLink href="/map" size="lg" variant="glass">
            {t.landing.ctaMap}
            <ArrowRight className="h-5 w-5 rtl:rotate-180" />
          </ButtonLink>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>
          <Link
            href="/map?mode=emergency"
            className="glass group mt-8 inline-flex items-center gap-2.5 rounded-full py-1.5 pe-4 ps-1.5 text-[13.5px] font-medium transition-transform hover:scale-[1.03]"
          >
            <span className="flex items-center gap-1.5 rounded-full bg-urgent px-2.5 py-1 text-[12px] font-bold text-white">
              <span className="relative flex h-1.5 w-1.5">
                <span className="pulse-ring absolute inset-0 rounded-full bg-white" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              {t.landing.liveNow}
            </span>
            <span className="text-label">
              🔥 {EMERGENCY_ZONES[0].region} · {urgent} {t.map.zoneStats.urgent}
            </span>
            <ArrowRight className="h-4 w-4 text-label-2 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
          </Link>
        </motion.div>
      </motion.div>

      <motion.div
        style={{ opacity: fade }}
        className="absolute inset-x-0 bottom-6 z-20 flex flex-col items-center gap-1 text-[12px] font-medium text-label-2"
      >
        {t.landing.scroll}
        <motion.span animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity }}>
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </motion.div>
    </section>
  );
}
