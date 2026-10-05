"use client";

import { motion } from "motion/react";
import { BadgeCheck, CalendarCheck, ChartNoAxesColumnIncreasing, MessageSquareReply, Siren, Sparkles as SparkIcon } from "lucide-react";
import { AppIcon } from "@/components/brand/Logo";
import { Aurora } from "@/components/ui/Aurora";
import { Emoji3D } from "@/components/ui/primitives";
import { Sparkles } from "@/components/ui/Sparkles";
import { useI18n } from "@/lib/i18n";

/* Desktop left panel of the paywall: what Pro gives, as living floating tiles. */
const TILES = [
  { Icon: SparkIcon, tint: "#0a84ff", x: "6%", y: "8%", r: -6 },
  { Icon: CalendarCheck, tint: "#30d158", x: "54%", y: "16%", r: 5 },
  { Icon: MessageSquareReply, tint: "#ff9f0a", x: "10%", y: "56%", r: 4 },
  { Icon: ChartNoAxesColumnIncreasing, tint: "#5e5ce6", x: "56%", y: "62%", r: -5 },
];

export function ProShowcase() {
  const { t } = useI18n();
  const labels = t.pro.proFeatures;
  return (
    <div className="relative hidden h-full flex-1 flex-col overflow-hidden bg-[linear-gradient(150deg,#0b1a3a_0%,#2a1a6e_45%,#6a1b4d_100%)] p-10 text-white md:flex">
      <Aurora intensity={0.9} />
      <Sparkles count={26} />
      <div className="relative flex items-center gap-3">
        <AppIcon className="h-12 w-12" glow />
        <span className="font-display text-[26px] font-black">pawlink <span className="bg-gradient-to-r from-[#ffd60a] to-[#ff9f0a] bg-clip-text text-transparent">Pro</span></span>
      </div>
      <h2 className="relative mt-6 max-w-[420px] text-[40px] font-black leading-[1.05]">{t.pro.title}</h2>
      <p className="relative mt-3 max-w-[400px] text-[16px] text-white/75">{t.pro.subtitle}</p>

      <div className="relative mt-6 flex-1">
        {TILES.map(({ Icon, tint, x, y, r }, i) => (
          <motion.div
            key={i}
            className="absolute w-[220px] rounded-[22px] border border-white/15 bg-white/10 p-4 backdrop-blur-xl"
            style={{ left: x, top: y }}
            initial={{ opacity: 0, y: 30, rotate: 0 }}
            animate={{ opacity: 1, y: [0, -10, 0], rotate: r }}
            transition={{ opacity: { delay: 0.2 + i * 0.12 }, rotate: { type: "spring", delay: 0.2 + i * 0.12 }, y: { duration: 4 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 } }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px]" style={{ background: tint }}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="mt-2 text-[14px] font-semibold leading-snug">{labels[i]}</div>
          </motion.div>
        ))}
        <motion.div className="absolute bottom-2 end-4" animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }} transition={{ duration: 3, repeat: Infinity }}>
          <Emoji3D src="/3d/star.png" size={90} className="drop-shadow-[0_0_30px_rgba(255,214,10,0.8)]" />
        </motion.div>
      </div>

      <div className="relative flex items-center gap-4 text-[13px] text-white/70">
        <span className="flex items-center gap-1.5"><BadgeCheck className="h-4 w-4" /> {t.svc.verified}</span>
        <span className="flex items-center gap-1.5"><Siren className="h-4 w-4" /> 24/7</span>
        <span>🐾 {t.pro.citizens}</span>
      </div>
    </div>
  );
}
