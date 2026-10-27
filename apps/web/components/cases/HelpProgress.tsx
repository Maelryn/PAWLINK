"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, MessageCircle, Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProfileLink } from "@/components/account/ProfileLink";
import { Button } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Avatar, Emoji3D } from "@/components/ui/primitives";
import { casesFromApi, withdrawHelp } from "@/lib/cases";
import { useI18n } from "@/lib/i18n";
import { HELP_EMOJI } from "@/lib/species";
import { store, useStore } from "@/lib/store";
import { apiOn } from "@/lib/api/client";
import { cases as casesApi } from "@/lib/api/endpoints";
import type { Case, HelpType, User } from "@/lib/types";
import { cn } from "@/lib/utils";

type Helper = Case["helpers"][number];
const STEPS = ["offered", "onway", "onsite"] as const;
const stepOf = (h: Helper) => (h.stage === "onsite" ? 2 : h.stage === "onway" ? 1 : 0);
/** What can be asked for once someone is with the animal. */
const NEXT: HelpType[] = ["medical", "transport", "foster", "boarding", "food", "funds"];

/** Call + WhatsApp for a number only the helpers and the reporter can see. */
export function PhoneActions({ phone, className }: { phone?: string; className?: string }) {
  const { t } = useI18n();
  if (!phone) return null;
  const n = phone.replace(/\s/g, "");
  return (
    <span className={cn("flex shrink-0 gap-1.5", className)}>
      <a href={`tel:${n}`} onClick={(e) => e.stopPropagation()} className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white transition-transform active:scale-90" aria-label={`${t.common.call} ${phone}`} title={phone}>
        <Phone className="h-4 w-4" />
      </a>
      <a href={`https://wa.me/${n.replace("+", "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex h-10 w-10 items-center justify-center rounded-full bg-stable text-white transition-transform active:scale-90" aria-label={t.flow.whatsapp}>
        <MessageCircle className="h-4 w-4" />
      </a>
    </span>
  );
}

/** Small status pill: Can help · On the way · With the animal. */
export function StagePill({ h }: { h: Helper }) {
  const { t } = useI18n();
  const k = STEPS[stepOf(h)];
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[11.5px] font-semibold", k === "onsite" ? "bg-stable-soft text-stable" : k === "onway" ? "bg-accent-soft text-accent" : "bg-surface-2 text-label-2")}>
      {k === "onsite" ? "🐾" : k === "onway" ? "🚗" : "✋"} {t.flow.stages[k]}
    </span>
  );
}

/** The helper's own panel: live steps, contact the reporter, ask for the next step, or step back. */
export function HelperPanel({ c, me, helping }: { c: Case; me: User; helping: Helper }) {
  const { t } = useI18n();
  const reporter = useStore((s) => s.users).find((u) => u.id === c.reporter.id);
  const step = stepOf(helping);
  const [want, setWant] = useState<HelpType[]>([]);
  const advance = () => {
    const next = step === 0 ? "onway" : "onsite";
    if (apiOn("cases")) void casesApi.setHelperStage(c.id, next).catch(() => {});
    store.setHelperStage(c.id, me.id, next);
    if (navigator.vibrate) navigator.vibrate(12);
    toast.success(next === "onway" ? t.flow.onWayDone : t.flow.onSiteDone);
  };
  return (
    <div className="space-y-3">
      <div className="rounded-[22px] bg-stable-soft p-4">
        <div className="flex items-center gap-3">
          <Emoji3D src={HELP_EMOJI[helping.helpType]} size={34} className="shrink-0" />
          <div className="min-w-0">
            <div className="text-[16px] font-bold">{t.life.helping}</div>
            <div className="text-[13.5px] text-label-2">{t.common.help[helping.helpType]}</div>
          </div>
        </div>

        {/* live steps: can help → on the way → with the animal */}
        <div className="mt-4 flex items-center">
          {STEPS.map((k, i) => (
            <div key={k} className={cn("flex items-center", i > 0 && "flex-1")}>
              {i > 0 && (
                <span className="mx-1.5 h-1 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
                  <motion.span className="block h-full rounded-full bg-stable" initial={false} animate={{ width: step >= i ? "100%" : "0%" }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
                </span>
              )}
              <motion.span
                initial={false}
                animate={{ scale: step === i ? 1.12 : 1 }}
                className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold", step >= i ? "bg-stable text-white" : "bg-surface text-label-3")}
              >
                {step > i || (step === i && i === STEPS.length - 1) ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
              </motion.span>
            </div>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-3 text-[11.5px] font-semibold text-label-2">
          {STEPS.map((k, i) => (
            <span key={k} className={cn(i === 1 && "text-center", i === 2 && "text-end", step >= i && "text-stable")}>{t.flow.stages[k]}</span>
          ))}
        </div>

        {step < 2 && c.status !== "resolved" && (
          <Button size="lg" className="mt-4 w-full" onClick={advance}>
            {step === 0 ? `🚗 ${t.flow.onWay}` : `🐾 ${t.flow.onSite}`}
          </Button>
        )}
      </div>

      {/* contact the reporter (private: only the people helping see it) */}
      {reporter?.phone && (
        <div className="flex items-center gap-3 rounded-[20px] bg-surface-2 p-3">
          <ProfileLink id={reporter.id}>
            <Avatar name={reporter.name} photo={reporter.photo} size={38} />
          </ProfileLink>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-label-2">{t.flow.contactReporter}</div>
            <ProfileLink id={reporter.id} className="block truncate text-[14.5px] font-semibold">{reporter.name}</ProfileLink>
          </div>
          <PhoneActions phone={reporter.phone} />
        </div>
      )}

      {/* with the animal: ask for the next step */}
      <AnimatePresence>
        {step === 2 && c.status !== "resolved" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[22px] border border-separator p-4">
            <div className="text-[16px] font-bold">{t.flow.needMore}</div>
            <p className="mt-0.5 text-[13px] text-label-2">{t.flow.needMoreBody}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {NEXT.map((h) => {
                const on = want.includes(h);
                return (
                  <motion.button
                    key={h}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setWant(on ? want.filter((x) => x !== h) : [...want, h])}
                    aria-pressed={on}
                    className={cn("flex min-h-12 items-center gap-2 rounded-[16px] border px-3 py-2 text-start text-[13.5px] font-semibold transition-colors", on ? "border-accent bg-accent-soft text-accent" : "border-separator bg-surface")}
                  >
                    <Emoji3D src={HELP_EMOJI[h]} size={24} /> {t.common.help[h]}
                  </motion.button>
                );
              })}
            </div>
            <Button
              className="mt-3 w-full"
              disabled={!want.length}
              onClick={() => {
                if (apiOn("cases")) void casesApi.requestNextHelp(c.id, want).catch(() => {});
                store.requestNextHelp(c.id, me.id, want);
                setWant([]);
                toast.success(t.flow.asked);
              }}
            >
              {t.flow.ask}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* the API has no route to step back yet: offered on the demo data only */}
      {!casesFromApi() && (
        <ConfirmButton onConfirm={() => { withdrawHelp(c, me); toast(t.life.stopped); }} className="h-10 w-full rounded-full text-[13.5px] font-semibold text-label-2">
          {t.life.stopHelp}
        </ConfirmButton>
      )}
    </div>
  );
}

/** For everyone else: who is already there, and what more is needed. */
export function OnSiteNotice({ c }: { c: Case }) {
  const { t } = useI18n();
  const onsite = c.helpers.find((h) => h.stage === "onsite");
  const onway = c.helpers.find((h) => h.stage === "onway");
  if (!onsite && !onway && !c.nextHelp) return null;
  return (
    <div className="mb-4 space-y-2">
      {(onsite || onway) && (
        <div className={cn("flex items-start gap-3 rounded-[18px] p-3.5", onsite ? "bg-stable-soft" : "bg-accent-soft")}>
          <span className="text-[22px] leading-none">{onsite ? "🐾" : "🚗"}</span>
          <div className="min-w-0">
            <div className={cn("text-[14.5px] font-bold", onsite ? "text-stable" : "text-accent")}>{onsite ? t.flow.someoneOnSite(onsite.user.name) : t.flow.someoneOnWay(onway!.user.name)}</div>
            {onsite && !c.nextHelp && <p className="text-[12.5px] text-label-2">{t.flow.onSiteBody}</p>}
          </div>
        </div>
      )}
      {c.nextHelp && (
        <div className="rounded-[18px] bg-monitor-soft p-3.5">
          <div className="text-[14.5px] font-bold text-monitor">⚡ {t.flow.requested}</div>
          <div className="mt-0.5 text-[12.5px] text-label-2">{t.flow.requestedBy}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.nextHelp.types.map((h) => (
              <span key={h} className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[12.5px] font-semibold">
                <Emoji3D src={HELP_EMOJI[h]} size={18} /> {t.common.help[h]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
