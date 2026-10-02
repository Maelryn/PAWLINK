"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { SERVICE_COLOR, SERVICE_EMOJI, SPECIES_EMOJI, TRIAGE_HEX } from "@/lib/species";
import type { Case, Service, Species, Triage } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Case pin: photo bubble (or 3D emoji) with triage ring, tail and pulse for urgent. */
export function CasePin({
  c,
  selected,
  dropIn,
  showLabel,
}: {
  c: Case;
  selected?: boolean;
  dropIn?: boolean;
  showLabel?: boolean;
}) {
  const color = TRIAGE_HEX[c.triage];
  const photo = c.photos[0];
  return (
    <motion.div
      className="group relative flex cursor-pointer flex-col items-center"
      style={{ transformOrigin: "50% 100%" }}
      initial={dropIn ? { y: -220, scale: 0.6, opacity: 0 } : { scale: 0, opacity: 0 }}
      animate={{ y: 0, scale: selected ? 1.3 : 1, opacity: 1 }}
      whileHover={{ scale: selected ? 1.34 : 1.12 }}
      transition={dropIn ? { type: "spring", stiffness: 240, damping: 13, delay: 0.25 } : { type: "spring", stiffness: 420, damping: 24 }}
    >
      {c.triage === "urgent" && (
        <span className="pointer-events-none absolute left-1/2 top-[22px] -ml-[22px] -mt-[22px] h-11 w-11">
          <span className="pulse-ring absolute inset-0 rounded-full" style={{ background: color }} />
        </span>
      )}
      {dropIn && (
        <motion.span
          className="pointer-events-none absolute left-1/2 top-[52px] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{ borderColor: color }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 2.6], opacity: [0.9, 0] }}
          transition={{ duration: 1.1, delay: 0.75, ease: "easeOut" }}
        />
      )}
      <div
        className={cn("relative h-[46px] w-[46px] overflow-hidden rounded-[15px] bg-white p-[2.5px] transition-shadow", selected ? "shadow-[0_14px_30px_-6px_rgba(0,0,0,0.45)]" : "shadow-[0_6px_16px_-4px_rgba(0,0,0,0.35)]")}
        style={{ boxShadow: `0 0 0 2.5px ${color}, ${selected ? "0 14px 30px -6px rgba(0,0,0,.45)" : "0 6px 16px -4px rgba(0,0,0,.35)"}` }}
      >
        {photo ? (
          <Image src={photo} alt="" width={84} height={84} className="h-full w-full rounded-[12.5px] object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-[12.5px] bg-gradient-to-br from-[#fff7ea] to-[#ffd9b8]">
            <Image src={SPECIES_EMOJI[c.species]} alt="" width={30} height={30} className="h-[30px] w-[30px]" />
          </div>
        )}
      </div>
      {photo && (
        <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md">
          <Image src={SPECIES_EMOJI[c.species]} alt="" width={18} height={18} className="h-[17px] w-[17px]" />
        </span>
      )}
      {(c.count ?? 1) > 1 && (
        <span className="absolute -left-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10.5px] font-bold text-white shadow-md" style={{ background: color }}>
          {c.count}
        </span>
      )}
      <span className="-mt-px h-0 w-0 border-x-[6px] border-t-[7px] border-x-transparent" style={{ borderTopColor: color }} />
      <span className="mt-0.5 h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 0 2px white` }} />
      {(showLabel || selected) && (
        <span
          className="pointer-events-none absolute top-full mt-1 max-w-[160px] truncate whitespace-nowrap text-center text-[12px] font-semibold text-[#1d1d1f] dark:text-white"
          style={{ textShadow: "0 0 3px var(--bg), 0 0 3px var(--bg), 0 0 6px var(--bg)" }}
        >
          {c.title}
        </span>
      )}
    </motion.div>
  );
}

export function ClusterPin({ count, worst, species }: { count: number; worst: Triage; species: Species[] }) {
  const color = TRIAGE_HEX[worst];
  const size = Math.min(78, 50 + Math.log2(count) * 7);
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.1 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className="relative flex cursor-pointer items-center justify-center"
      style={{ width: size, height: size }}
    >
      {worst === "urgent" && <span className="pulse-ring absolute inset-1 rounded-full" style={{ background: color }} />}
      <span className="glass-strong absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 3px ${color}, 0 10px 24px -6px rgba(0,0,0,.35)` }} />
      <div className="relative flex flex-col items-center leading-none">
        <div className="flex -space-x-2">
          {species.slice(0, 3).map((s, i) => (
            <Image key={i} src={SPECIES_EMOJI[s]} alt="" width={20} height={20} className="h-5 w-5 drop-shadow" />
          ))}
        </div>
        <span className="mt-0.5 text-[13px] font-bold tabular-nums text-label">{count}</span>
      </div>
    </motion.div>
  );
}

export function ServicePin({ s, selected }: { s: Service; selected?: boolean }) {
  const color = SERVICE_COLOR[s.type];
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: selected ? 1.25 : 1 }}
      whileHover={{ scale: 1.15 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      className="flex cursor-pointer flex-col items-center"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full border-[2.5px] border-white shadow-[0_6px_14px_-4px_rgba(0,0,0,0.4)]" style={{ background: color }}>
        <Image src={SERVICE_EMOJI[s.type]} alt="" width={22} height={22} className="h-[20px] w-[20px]" />
      </div>
    </motion.div>
  );
}

export function UserDot() {
  return (
    <div className="relative h-5 w-5">
      <span className="pulse-ring absolute inset-0 rounded-full bg-accent" />
      <span className="absolute inset-0 rounded-full border-[3px] border-white bg-accent shadow-lg" />
    </div>
  );
}

export function FireMarker({ delay = 0, size = 34 }: { delay?: number; size?: number }) {
  return (
    <motion.div
      className="pointer-events-none"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: [0.9, 1.12, 0.95, 1.05, 0.9], opacity: 1, y: [0, -3, 0, -2, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, delay, ease: "easeInOut" }}
    >
      <Image src="/3d/fire.png" alt="" width={size} height={size} style={{ width: size, height: size }} className="drop-shadow-[0_0_14px_rgba(255,90,0,0.8)]" />
    </motion.div>
  );
}
