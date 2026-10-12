"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronLeft, Lock, Sparkles as SparkIcon, Store, X, Ticket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AppIcon } from "@/components/brand/Logo";
import { Segmented } from "@/components/ui/primitives";
import { Burst, Sparkles } from "@/components/ui/Sparkles";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { proActive, store, useStore } from "@/lib/store";
import { paywallStartTier } from "@/lib/ui";
import { cn } from "@/lib/utils";

/* PawLink Pro paywall — iOS subscription-sheet style, fits one phone screen.
   Real payment later: Chargily Pay (CIB / Edahabia) → webhook → backend activates the plan. */

type Tier = "pro" | "plus";
type Period = "month" | "year";
const PRICES: Record<Tier, Record<Period, number>> = {
  pro: { month: 2900, year: 29000 },
  plus: { month: 5900, year: 59000 },
};
const fmt = (n: number) => `${n.toLocaleString("fr-FR").replace(/ /g, " ")} DA`;

export function Paywall({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const me = useSession();
  const router = useRouter();
  // what this business already has: Pro+ is the top plan, a Pro business is offered the upgrade
  const current: Tier | null = proActive(me) ? me!.pro!.plan : null;
  const myService = useStore((s) => s.services).find((x) => x.id === me?.serviceId);
  // the plan picked by the person; until they pick, the best next step for them (the account loads after this screen)
  const [picked, setTier] = useState<Tier | null>(() => paywallStartTier());
  const tier: Tier = picked ?? (current === "pro" ? "plus" : "pro");
  const isCurrent = current === tier;
  const [period, setPeriod] = useState<Period>("month");
  const [step, setStep] = useState<"plans" | "pay">("plans");
  const [method, setMethod] = useState<"edahabia" | "cib">("edahabia");
  const [paying, setPaying] = useState(false);
  const [burst, setBurst] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [free, setFree] = useState(false);
  const price = PRICES[tier][period];
  const priceLabel = `${fmt(price)} ${period === "month" ? t.pay.perMonth : t.pay.perYear}`;

  const subscribe = () => {
    if (!me) {
      onClose();
      return router.push("/login?mode=up&next=/pro");
    }
    if (!me.serviceId) {
      toast(t.pro.needBiz);
      onClose();
      return router.push("/account?tab=profile#business");
    }
    if (myService?.status !== "approved") return toast(t.pro.pendingBiz);
    if (isCurrent || current === "plus") return; // can't buy the plan you already have
    setStep("pay");
  };

  const pay = () => {
    setPaying(true);
    setTimeout(() => {
      setBurst(true);
      store.activatePro(me!.id, period === "year" ? 365 : 30, tier);
      toast.success(t.pro.paid);
      setTimeout(() => {
        onClose();
        router.push("/account?tab=pro");
      }, 1400);
    }, 1100);
  };

  return (
    <div className="relative flex h-full flex-col overflow-y-auto overflow-x-hidden bg-[#f2f2f7] px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-4 dark:bg-[#0b0b0d]">
      {/* soft animated glow + sparkles behind the icon */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[42%]">
        <motion.div
          className="absolute left-1/2 top-6 h-56 w-56 -translate-x-1/2 rounded-full bg-[conic-gradient(from_0deg,#0a84ff,#5e5ce6,#ff375f,#ffd60a,#0a84ff)] opacity-30 blur-3xl"
          animate={{ rotate: 360, scale: [1, 1.15, 1] }}
          transition={{ rotate: { duration: 12, repeat: Infinity, ease: "linear" }, scale: { duration: 4, repeat: Infinity } }}
        />
        <Sparkles count={14} colors={["#ffd60a", "#5e5ce6", "#ff375f", "#0a84ff"]} />
      </div>

      {/* top bar */}
      <div className="relative flex shrink-0 items-center justify-between">
        {step === "pay" ? (
          <button type="button" onClick={() => setStep("plans")} className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm dark:bg-white/10" aria-label={t.common.back}>
            <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm dark:bg-white/10" aria-label={t.common.close}>
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* header */}
      <div className="relative flex shrink-0 flex-col items-center text-center">
        <motion.div initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 220, damping: 12 }} className="relative">
          <AppIcon className="h-[72px] w-[72px] sm:h-20 sm:w-20 [@media(max-height:800px)]:h-14 [@media(max-height:800px)]:w-14" glow />
          <motion.span
            className="absolute -end-2 -top-2 flex h-7 items-center rounded-full bg-gradient-to-r from-[#ffd60a] to-[#ff9f0a] px-2 text-[11px] font-black text-[#1d1d1f] shadow"
            animate={{ rotate: [0, -8, 8, 0] }}
            transition={{ duration: 2.4, repeat: Infinity }}
          >
            PRO
          </motion.span>
        </motion.div>
        <h1 className="mt-3 text-[30px] font-black leading-tight sm:text-[34px] [@media(max-height:800px)]:mt-2 [@media(max-height:800px)]:text-[26px]">{t.pay.title}</h1>
        <p className="mt-1 max-w-[320px] text-[14.5px] text-label-2 [@media(max-height:800px)]:hidden">{t.pay.sub}</p>
      </div>

      {current === "plus" ? (
        <div className="relative mt-auto flex flex-col items-center gap-3 pt-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-stable text-white"><Check className="h-7 w-7" strokeWidth={3} /></span>
          <div className="text-[20px] font-bold">{t.pay.allSet}</div>
          <p className="max-w-[300px] text-[14px] text-label-2">{t.pay.allSetBody(new Date(me!.pro!.until).toLocaleDateString())}</p>
          <button type="button" onClick={() => { onClose(); router.push("/account?tab=pro"); }} className="mt-2 h-12 w-full rounded-full bg-[#1d1d1f] text-[15px] font-semibold text-white dark:bg-white dark:text-black">
            {t.pay.manage}
          </button>
        </div>
      ) : (
      <AnimatePresence mode="wait" initial={false}>
        {step === "plans" ? (
          <motion.div key="plans" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="relative mt-auto flex flex-col gap-3 pt-4">
            <Segmented
              layoutId="tier-seg"
              className="w-full [&>button]:h-9 [&>button]:flex-1 [&>button]:text-[14.5px]"
              value={tier}
              onChange={setTier}
              options={[
                { value: "pro", label: t.pay.tiers.pro },
                { value: "plus", label: <><SparkIcon className="h-3.5 w-3.5" />{t.pay.tiers.plus}</> },
              ]}
            />
            {(["month", "year"] as Period[]).map((p) => {
              const on = period === p;
              return (
                <motion.button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  whileTap={{ scale: 0.98 }}
                  className="relative overflow-hidden rounded-[24px] p-[2px] text-start"
                >
                  {/* selected: animated glowing border */}
                  {on && (
                    <motion.span
                      layoutId="plan-glow"
                      className="absolute inset-0 overflow-hidden rounded-[24px]"
                      transition={{ type: "spring", stiffness: 400, damping: 34 }}
                    >
                      <motion.span
                        className="absolute -inset-[80%] bg-[conic-gradient(from_0deg,#0a84ff,#5e5ce6,#ff375f,#ffd60a,#30d158,#0a84ff)]"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      />
                    </motion.span>
                  )}
                  <span className={cn("relative block rounded-[22px] bg-white px-4 py-3.5 dark:bg-[#1c1c1e]", !on && "ring-1 ring-inset ring-black/[0.06] dark:ring-white/10")}>
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="flex items-center gap-2 text-[18px] font-bold">
                          {t.pay.tiers[tier]} {p === "month" ? t.pay.monthly : t.pay.yearly}
                          {p === "year" && <span className="rounded-full bg-stable-soft px-2 py-0.5 text-[11px] font-bold text-stable">{t.pay.save}</span>}
                        </span>
                        <span className="text-[14px] text-label-2">{fmt(PRICES[tier][p])} {p === "month" ? t.pay.perMonth : t.pay.perYear}</span>
                      </span>
                      <span className={cn("mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors", on ? "border-accent bg-accent text-white" : "border-label-3")}>
                        {on && <Check className="h-4 w-4" strokeWidth={3} />}
                      </span>
                    </span>
                    <span className={cn("mt-2.5 flex items-start gap-2 border-t border-separator pt-2.5 text-[13px] text-label-2 [@media(max-height:800px)]:mt-2 [@media(max-height:800px)]:pt-2 [@media(max-height:800px)]:text-[12px]", !on && "[@media(max-height:720px)]:hidden")}>
                      <Store className="mt-0.5 h-4 w-4 shrink-0" /> {t.pay.features[tier]}
                    </span>
                  </span>
                </motion.button>
              );
            })}

            {/* CTA with shimmer */}
            <motion.button
              type="button"
              onClick={subscribe}
              disabled={isCurrent}
              whileTap={{ scale: isCurrent ? 1 : 0.97 }}
              className={cn(
                "relative mt-1 overflow-hidden rounded-full px-4 py-3 text-white",
                isCurrent ? "bg-label-3" : "bg-gradient-to-r from-[#0a7cff] via-[#5e5ce6] to-[#ff2d78] shadow-[0_14px_34px_-12px_rgba(94,92,230,0.9)]",
              )}
            >
              <motion.span
                className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                animate={{ left: ["-40%", "140%"] }}
                transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.2 }}
              />
              <span className="relative block text-[17px] font-bold">
                {isCurrent ? t.pay.current : current === "pro" ? t.pay.upgrade : free ? `${t.pay.cta} · 0 DA` : t.pay.cta}
              </span>
              <span className="relative block text-[11.5px] text-white/85">{isCurrent ? t.pay.currentUntil(new Date(me!.pro!.until).toLocaleDateString()) : current ? t.pay.daysKept : t.pay.renew(priceLabel)}</span>
            </motion.button>

            {code === null ? (
              <button type="button" onClick={() => setCode("")} className="flex h-[52px] w-full shrink-0 items-center justify-center gap-2 rounded-full bg-white text-[16px] font-semibold shadow-sm transition-transform active:scale-[0.98] dark:bg-white/10">
                <Ticket className="h-[18px] w-[18px] text-accent" /> {t.pay.code}
              </button>
            ) : (
              <form
                className="flex w-full shrink-0 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (code.trim().toUpperCase() === "DEMODAY") {
                    setFree(true);
                    toast.success(t.pay.codeOk);
                  } else toast.error(t.pay.codeBad);
                }}
              >
                <input autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder={t.pay.codePh} className="h-[52px] w-0 min-w-0 flex-1 rounded-full bg-white px-5 text-[16px] uppercase shadow-sm outline-none ring-accent/40 focus:ring-2 dark:bg-white/10" />
                <button type="submit" className="h-[52px] w-[72px] shrink-0 rounded-full bg-[#1d1d1f] text-[16px] font-semibold text-white transition-transform active:scale-95 dark:bg-white dark:text-black">OK</button>
              </form>
            )}
            <p className="text-center text-[11px] text-label-2 [@media(max-height:800px)]:hidden">🐾 {t.pro.citizens}</p>
          </motion.div>
        ) : (
          <motion.div key="pay" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="relative mt-auto flex flex-col gap-3 pt-4">
            <div className="flex items-baseline justify-between rounded-[22px] bg-white p-4 dark:bg-[#1c1c1e]">
              <span className="font-semibold">{t.pay.tiers[tier]} · {period === "month" ? t.pay.monthly : t.pay.yearly}</span>
              <span className="text-[20px] font-bold">{free ? "0 DA" : fmt(price)}</span>
            </div>
            <div className="text-[13px] font-semibold text-label-2">{t.pay.payWith}</div>
            <div className="grid grid-cols-2 gap-2">
              {(["edahabia", "cib"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMethod(m)} className={cn("h-16 rounded-[18px] text-[16px] font-black transition-colors", method === m ? "bg-accent-soft text-accent ring-2 ring-accent" : "bg-white dark:bg-[#1c1c1e]")}>
                  {m === "edahabia" ? "Edahabia" : "CIB"}
                </button>
              ))}
            </div>
            <p className="flex items-center gap-1.5 text-[12px] text-label-2"><Lock className="h-3.5 w-3.5" /> {t.pro.demoNote}</p>
            <motion.button type="button" onClick={pay} disabled={paying} whileTap={{ scale: 0.97 }} className="h-14 rounded-full bg-gradient-to-r from-[#0a7cff] via-[#5e5ce6] to-[#ff2d78] text-[17px] font-bold text-white shadow-[0_14px_34px_-12px_rgba(94,92,230,0.9)] disabled:opacity-80">
              {paying ? <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" /> : t.pay.confirm(free ? "0 DA" : fmt(price))}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
      )}
      {burst && <Burst count={48} />}
    </div>
  );
}
