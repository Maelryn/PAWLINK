"use client";

import { BadgeCheck, HeartHandshake, Phone, ShieldCheck, Stethoscope } from "lucide-react";
import type { BadgeId } from "@/lib/badges";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const STYLE: Record<BadgeId, { Icon: typeof BadgeCheck; cls: string }> = {
  vet: { Icon: Stethoscope, cls: "bg-accent-soft text-accent" },
  hero: { Icon: HeartHandshake, cls: "bg-gradient-to-r from-[#ff9f0a] to-[#ff2d78] text-white" },
  helper: { Icon: HeartHandshake, cls: "bg-stable-soft text-stable" },
  reporter: { Icon: ShieldCheck, cls: "bg-stable-soft text-stable" },
  phone: { Icon: Phone, cls: "bg-surface-2 text-label-2" },
};

/** Small trust chips next to a name. `compact` keeps only the strongest one. */
export function UserBadges({ badges, compact, className }: { badges: BadgeId[]; compact?: boolean; className?: string }) {
  const { t } = useI18n();
  const list = compact ? badges.filter((b) => b !== "phone").slice(0, 1) : badges;
  if (!list.length) return null;
  return (
    <span className={cn("inline-flex flex-wrap gap-1.5", className)}>
      {list.map((b) => {
        const { Icon, cls } = STYLE[b];
        return (
          <span key={b} className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] font-semibold", cls)}>
            <Icon className="h-3.5 w-3.5" /> {t.profile.badges[b]}
          </span>
        );
      })}
    </span>
  );
}
