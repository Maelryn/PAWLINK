"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import { TRIAGE_COLOR } from "@/lib/species";
import type { Triage } from "@/lib/types";
import { useSyncExternalStore } from "react";
import { cn, hashHue, initials, minutesSince } from "@/lib/utils";

/* ───────────── 3D emoji ───────────── */
export function Emoji3D({
  src,
  size = 40,
  className,
  alt = "",
  priority,
}: {
  src: string;
  size?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      draggable={false}
      className={cn("pointer-events-none select-none object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

/* ───────────── Triage badge ───────────── */
export function TriageBadge({ triage, size = "md", className }: { triage: Triage; size?: "sm" | "md" | "lg"; className?: string }) {
  const { t } = useI18n();
  const color = TRIAGE_COLOR[triage];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        size === "sm" && "h-6 px-2 text-[11px]",
        size === "md" && "h-7 px-2.5 text-[12px]",
        size === "lg" && "h-9 px-3.5 text-[14px]",
        className,
      )}
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <span className="relative flex h-2 w-2">
        {triage === "urgent" && <span className="pulse-ring absolute inset-0 rounded-full" style={{ background: color }} />}
        <span className="relative h-2 w-2 rounded-full" style={{ background: color }} />
      </span>
      {t.common.triage[triage]}
    </span>
  );
}

/* ───────────── Chip (toggle) ───────────── */
export function Chip({
  active,
  onClick,
  children,
  className,
  color,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13.5px] font-medium transition-colors duration-200",
        active ? "bg-label text-bg" : "bg-surface text-label ring-1 ring-inset ring-black/[0.06] hover:bg-surface-2 dark:ring-white/10",
        className,
      )}
      style={active && color ? { background: color, color: "#fff" } : undefined}
    >
      {children}
    </motion.button>
  );
}

/* ───────────── Segmented control ───────────── */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  layoutId = "seg",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
  layoutId?: string;
}) {
  return (
    <div className={cn("relative inline-flex rounded-full bg-surface-2 p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-0 flex h-8 items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors",
              active ? "text-label" : "text-label-2 hover:text-label",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 -z-10 rounded-full bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.12)] dark:bg-surface-3"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ───────────── Avatar ───────────── */
export function Avatar({ name, size = 32, className, ring, photo }: { name: string; size?: number; className?: string; ring?: boolean; photo?: string }) {
  const h = hashHue(name);
  if (photo)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt={name} title={name} className={cn("shrink-0 rounded-full object-cover", ring && "ring-2 ring-surface", className)} style={{ width: size, height: size }} />
    );
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", ring && "ring-2 ring-surface", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(140deg, hsl(${h} 80% 62%), hsl(${(h + 40) % 360} 75% 48%))`,
      }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

/* ───────────── Card ───────────── */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card rounded-[28px]", className)} {...rest}>
      {children}
    </div>
  );
}

/* ───────────── Section label ───────────── */
export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-4", className)}>
      <h3 className="text-[20px] font-bold tracking-[-0.02em]">{children}</h3>
      {action}
    </div>
  );
}

/* ───────────── Stars ───────────── */
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} / 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <svg key={i} viewBox="0 0 20 20" className="h-3.5 w-3.5">
            <defs>
              <linearGradient id={`st${i}${Math.round(value * 10)}`}>
                <stop offset={fill} stopColor="#ff9f0a" />
                <stop offset={fill} stopColor="var(--surface-3)" />
              </linearGradient>
            </defs>
            <path
              fill={`url(#st${i}${Math.round(value * 10)})`}
              d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z"
            />
          </svg>
        );
      })}
    </span>
  );
}

/* ───────────── Photo with emoji fallback ───────────── */
export function CasePhoto({
  photo,
  emoji,
  className,
  emojiSize = 72,
  sizes = "400px",
  priority,
}: {
  photo?: string;
  emoji: string;
  className?: string;
  emojiSize?: number;
  sizes?: string;
  priority?: boolean;
}) {
  if (photo)
    return (
      <div className={cn("relative overflow-hidden bg-surface-2", className)}>
        <Image src={photo} alt="" fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    );
  return (
    <div
      className={cn("relative flex items-center justify-center overflow-hidden", className)}
      style={{ background: "radial-gradient(120% 120% at 30% 20%, #fff7e8 0%, #ffe3c2 45%, #ffc9a8 100%)" }}
    >
      <Emoji3D src={emoji} size={emojiSize} className="drop-shadow-[0_10px_16px_rgba(120,60,0,0.25)]" />
    </div>
  );
}

/* ───────────── Relative time (client-only, avoids SSR/CSR clock mismatch) ───────────── */
const noopSubscribe = () => () => {};
export function useMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function TimeAgo({ iso }: { iso: string }) {
  const { t } = useI18n();
  const mounted = useMounted();
  if (!mounted) return <span className="inline-block w-10" />;
  return <>{t.common.ago(minutesSince(iso))}</>;
}
