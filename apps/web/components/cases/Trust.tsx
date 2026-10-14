"use client";

import { alreadyFlagged, flagCase, voteOnCase } from "@/lib/cases";

import { Check, CircleHelp, Flag, ShieldCheck, ShieldAlert, Shield, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Emoji3D } from "@/components/ui/primitives";
import { useSession } from "@/lib/auth";
import { geoIssue, getPosition } from "@/lib/geo";
import { distanceKm } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { Case, TrustLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Answering is only possible this close to the animal (checked here and again by the API). */
const VERIFY_RADIUS_KM = 1;

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
  const me = useSession();
  if (!c.trust) return null;
  return (
    <section id="verify" className="card scroll-mt-24 rounded-[32px] p-6">
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
      <div className="mt-4 border-t border-separator pt-4 text-[13.5px] font-medium text-label-2">
        {t.verify.count(c.trust.confirmedBy?.length ?? c.trust.confirmations, c.trust.deniedBy?.length ?? 0)}
      </div>
      {canAct && c.status !== "resolved" && <NearbyCheck c={c} />}
      {canAct && me && (
        <button
          type="button"
          disabled={alreadyFlagged(c, me)}
          onClick={async () => {
            const r = await flagCase(c, me);
            if (r.ok) toast(t.trust.flagged);
            else toast.error(t.auth.errors[r.code] ?? r.message ?? t.auth.errors.UNKNOWN);
          }}
          className="mt-3 flex h-10 items-center gap-1.5 rounded-full px-1 text-[13.5px] font-semibold text-label-2 transition-opacity hover:opacity-70 disabled:opacity-60"
        >
          <Flag className="h-4 w-4" /> {alreadyFlagged(c, me) ? t.trust.flagged : t.trust.flag}
        </button>
      )}
    </section>
  );
}

/** "Do you see this animal?": only someone standing near it can answer, once. Two yes = verified. */
function NearbyCheck({ c }: { c: Case }) {
  const { t } = useI18n();
  const me = useSession();
  const [busy, setBusy] = useState<null | "yes" | "no">(null);
  if (!me) return null;
  const answered = c.trust?.confirmedBy?.includes(me.id) || c.trust?.deniedBy?.includes(me.id);
  if (answered)
    return (
      <div className="mt-3 flex items-center gap-2.5 rounded-[18px] bg-stable-soft p-3.5 text-[14px] font-semibold text-stable">
        <Check className="h-4 w-4 shrink-0" strokeWidth={3} /> {t.verify.answered}
      </div>
    );
  const answer = async (seen: boolean) => {
    setBusy(seen ? "yes" : "no");
    const here = await getPosition(10000, true);
    if (!here) {
      setBusy(null);
      return toast.error(geoIssue() ? t.geo.why[geoIssue()!] : t.verify.noLoc);
    }
    const km = distanceKm(here, c.location);
    if (km > VERIFY_RADIUS_KM) {
      setBusy(null);
      return toast.error(t.verify.tooFar(km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`));
    }
    const r = await voteOnCase(c, me.id, seen);
    setBusy(null);
    if (!r.ok) return toast.error(t.auth.errors[r.code] ?? r.message ?? t.auth.errors.UNKNOWN);
    if (navigator.vibrate) navigator.vibrate(12);
    toast.success(seen ? t.verify.thanksYes : t.verify.thanksNo);
  };
  return (
    <div className="mt-3 rounded-[22px] bg-accent-soft p-4">
      <div className="flex items-start gap-3">
        <Emoji3D src="/3d/pin.png" size={34} className="shrink-0" />
        <div>
          <div className="text-[16px] font-bold">{t.verify.title}</div>
          <p className="mt-0.5 text-[13px] leading-snug text-label-2">{t.verify.body}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={!!busy} onClick={() => answer(true)} className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-stable text-[14.5px] font-semibold text-white transition-transform active:scale-95 disabled:opacity-60">
          {busy === "yes" ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Check className="h-4 w-4" strokeWidth={2.8} />} {t.verify.yes}
        </button>
        <button type="button" disabled={!!busy} onClick={() => answer(false)} className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-surface text-[14.5px] font-semibold transition-transform active:scale-95 disabled:opacity-60">
          {busy === "no" ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-label-3 border-t-label" /> : <X className="h-4 w-4" strokeWidth={2.8} />} {t.verify.no}
        </button>
      </div>
      {busy && <p className="mt-2 text-center text-[12.5px] text-label-2">{t.verify.checking}</p>}
    </div>
  );
}
