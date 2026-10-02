"use client";

import { Check, CircleHelp, Flag, ShieldCheck, ShieldAlert, Shield, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { store } from "@/lib/store";
import type { Case, TrustLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLE: Record<TrustLevel, { cls: string; Icon: typeof Shield }> = {
  verified: { cls: "bg-stable-soft text-stable", Icon: ShieldCheck },
  unverified: { cls: "bg-surface-2 text-label-2", Icon: Shield },
  suspicious: { cls: "bg-monitor-soft text-monitor", Icon: ShieldAlert },
};

export function TrustBadge({ level, className }: { level: TrustLevel; className?: string }) {
  const { t } = useI18n();
  const { cls, Icon } = STYLE[level];
  return (
    <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold", cls, className)}>
      <Icon className="h-3.5 w-3.5" /> {t.trust.level[level]}
    </span>
  );
}

/** Checks list + community actions ("I see it too" / "report as fake"). */
export function TrustPanel({ c, canAct }: { c: Case; canAct: boolean }) {
  const { t } = useI18n();
  if (!c.trust) return null;
  return (
    <section className="card rounded-[32px] p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-bold tracking-[-0.02em]">{t.trust.title}</h2>
        <TrustBadge level={c.trust.level} />
      </div>
      <p className="mt-1 text-[13px] text-label-2">{t.trust.why}</p>
      <ul className="mt-4 space-y-2">
        {c.trust.checks.map((ch) => (
          <li key={ch.id} className="flex items-center gap-3 text-[14px]">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                ch.ok === true && "bg-stable text-white",
                ch.ok === false && "bg-urgent text-white",
                ch.ok === null && "bg-surface-2 text-label-2",
              )}
            >
              {ch.ok === true ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : ch.ok === false ? <X className="h-3.5 w-3.5" strokeWidth={3} /> : <CircleHelp className="h-3.5 w-3.5" />}
            </span>
            <span className={cn("flex-1", ch.ok === null && "text-label-2")}>{t.trust.checks[ch.id]}</span>
            {ch.ok === null && <span className="text-[12px] text-label-3">{t.trust.unknown}</span>}
          </li>
        ))}
      </ul>
      <div className="mt-4 border-t border-separator pt-4 text-[13.5px] font-medium text-label-2">{t.trust.confirmations(c.trust.confirmations)}</div>
      {canAct && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              store.confirm(c.id);
              toast.success(t.trust.confirmed);
            }}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-stable-soft text-[14px] font-semibold text-stable"
          >
            <Check className="h-4 w-4" strokeWidth={2.6} /> {t.trust.confirm}
          </button>
          <button
            type="button"
            onClick={() => {
              store.flag(c.id);
              toast(t.trust.flagged);
            }}
            className="flex h-10 items-center justify-center gap-1.5 rounded-full bg-surface-2 px-4 text-[14px] font-semibold text-label-2"
          >
            <Flag className="h-4 w-4" /> {t.trust.flag}
          </button>
        </div>
      )}
    </section>
  );
}
