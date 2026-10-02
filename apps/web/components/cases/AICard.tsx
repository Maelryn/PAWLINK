"use client";

import { motion } from "motion/react";
import { AlertTriangle, ShieldAlert, Sparkles, Stethoscope } from "lucide-react";
import Link from "next/link";
import { Avatar, Emoji3D } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import { HELP_EMOJI, SERVICE_EMOJI, TRIAGE_COLOR } from "@/lib/species";
import type { AIAnalysis } from "@/lib/types";
import { cn } from "@/lib/utils";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};
const item = {
  hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring", stiffness: 260, damping: 26 } },
} as const;

/** Structured AI triage output. `reveal` plays the staggered entrance (report flow). */
export function AICard({ ai, compact, reveal, className }: { ai: AIAnalysis; compact?: boolean; reveal?: boolean; className?: string }) {
  const { t } = useI18n();
  const color = TRIAGE_COLOR[ai.triage];

  return (
    <motion.div
      variants={container}
      initial={reveal ? "hidden" : false}
      animate="show"
      className={cn("relative overflow-hidden rounded-[28px] bg-surface p-5 shadow-[var(--card-shadow)]", className)}
    >
      {/* soft triage glow */}
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-25 blur-3xl" style={{ background: color }} />

      <motion.div variants={item} className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#0a7cff] via-[#5e5ce6] to-[#ff2d55] text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-[15px] font-semibold">{t.ai.title}</span>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-label-2">
          {t.ai.confidence}
          <span className="relative h-1.5 w-14 overflow-hidden rounded-full bg-surface-2">
            <motion.span
              className="absolute inset-y-0 start-0 rounded-full"
              style={{ background: color }}
              initial={{ width: 0 }}
              animate={{ width: `${ai.confidence * 100}%` }}
              transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          </span>
          <span className="tabular-nums">{Math.round(ai.confidence * 100)}%</span>
        </div>
      </motion.div>

      <motion.div variants={item} className="relative mt-4">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-label-2">{t.ai.triageLabel}</div>
        <div className="mt-1 text-[34px] font-bold leading-none tracking-[-0.03em]" style={{ color }}>
          {t.common.triage[ai.triage]}
        </div>
        {ai.forcedUrgentByRule && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-urgent-soft px-2.5 py-1 text-[12px] font-semibold text-urgent">
            <ShieldAlert className="h-3.5 w-3.5" /> {t.ai.forced}
          </div>
        )}
        <p className="mt-3 text-[15px] leading-relaxed text-label">{ai.summary}</p>
      </motion.div>

      {ai.possiblyContagious && (
        <motion.div variants={item} className="relative mt-4 flex gap-3 rounded-[18px] bg-monitor-soft p-3.5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-monitor" />
          <div>
            <div className="text-[14px] font-semibold text-monitor">{t.ai.contagious}</div>
            <div className="text-[13px] text-label-2">{t.ai.contagiousBody}</div>
            {!compact && ai.contagionAdvice && (
              <ul className="mt-2 space-y-1 text-[13px] text-label">
                {ai.contagionAdvice.map((a) => (
                  <li key={a}>• {a}</li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      )}

      {!compact && (
        <motion.div variants={item} className="relative mt-5">
          <div className="mb-2 text-[13px] font-semibold text-label-2">{t.ai.signs}</div>
          <div className="flex flex-wrap gap-1.5">
            {ai.observedSigns.map((s) => (
              <span key={s} className="rounded-full bg-surface-2 px-3 py-1.5 text-[13px]">
                {s}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div variants={item} className="relative mt-5">
        <div className="mb-2 text-[13px] font-semibold text-label-2">{t.ai.safety}</div>
        <ol className="space-y-2">
          {(compact ? ai.safetyAdvice.slice(0, 3) : ai.safetyAdvice).map((a, i) => (
            <li key={a} className="flex gap-3 text-[14px] leading-snug">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold text-accent">{i + 1}</span>
              <span>{a}</span>
            </li>
          ))}
        </ol>
      </motion.div>

      {!compact && (
        <>
          <motion.div variants={item} className="relative mt-5">
            <div className="mb-2 text-[13px] font-semibold text-label-2">{t.ai.needs}</div>
            <div className="flex flex-wrap gap-2">
              {ai.recommendedHelp.map((h) => (
                <span key={h} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pe-3 ps-1.5 text-[13px] font-medium">
                  <Emoji3D src={HELP_EMOJI[h]} size={22} />
                  {t.common.help[h]}
                </span>
              ))}
            </div>
          </motion.div>

          {!!ai.suggestedHelpers?.length && (
            <motion.div variants={item} className="relative mt-5">
              <div className="mb-2 text-[13px] font-semibold text-label-2">{t.aiExtra.helpers}</div>
              <div className="flex flex-wrap gap-2">
                {ai.suggestedHelpers.map((h) => (
                  <span key={h.userId} className="inline-flex items-center gap-2 rounded-full bg-surface-2 py-1 pe-3 ps-1 text-[13px]">
                    <Avatar name={h.name} size={26} />
                    <span className="font-semibold">{h.name.replace(/^Dr\.\s*/, "Dr ").split(" ").slice(0, 2).join(" ")}</span>
                    <Emoji3D src={HELP_EMOJI[h.helpType]} size={18} />
                    <span className="tabular-nums text-label-2">{t.common.km(h.distanceKm)}</span>
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {ai.suggestedServices.length > 0 && (
            <motion.div variants={item} className="relative mt-5">
              <div className="mb-2 text-[13px] font-semibold text-label-2">{t.ai.services}</div>
              <div className="divide-y divide-separator overflow-hidden rounded-[18px] bg-surface-2">
                {ai.suggestedServices.map((s) => (
                  <Link key={s.serviceId} href={`/services?id=${s.serviceId}`} className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-surface-3">
                    <Emoji3D src={SERVICE_EMOJI[s.type]} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold">{s.name}</div>
                      <div className="text-[12px] text-label-2">{t.common.service[s.type]}</div>
                    </div>
                    <span className="text-[13px] font-semibold tabular-nums text-accent">{t.common.km(s.distanceKm)}</span>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </>
      )}

      <motion.div variants={item} className="relative mt-5 flex items-center gap-2 border-t border-separator pt-3.5 text-[12.5px] text-label-2">
        <Stethoscope className="h-4 w-4 shrink-0" />
        {ai.disclaimer}
      </motion.div>
    </motion.div>
  );
}
