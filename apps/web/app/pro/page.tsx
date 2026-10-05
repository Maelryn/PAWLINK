"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { TopNav } from "@/components/layout/TopNav";
import { Reveal } from "@/components/motion";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Emoji3D } from "@/components/ui/primitives";
import { Burst, Sparkles } from "@/components/ui/Sparkles";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { store } from "@/lib/store";
import { cn } from "@/lib/utils";

/* Income: PawLink Pro for businesses. Citizens never pay.
   Real payment = Chargily Pay (CIB / Edahabia) checkout → webhook → backend activates Pro. */
export default function ProPage() {
  const { t } = useI18n();
  const me = useSession();
  const router = useRouter();
  const [checkout, setCheckout] = useState(false);
  const [method, setMethod] = useState<"cib" | "edahabia">("edahabia");
  const [paying, setPaying] = useState(false);
  const [burst, setBurst] = useState(false);
  const isPro = !!me?.pro && new Date(me.pro.until) > new Date();

  const choose = () => {
    if (!me) return router.push("/login?mode=up&next=/pro");
    if (!me.serviceId) return toast(t.pro.needBiz);
    setCheckout(true);
  };

  const pay = () => {
    setPaying(true);
    setTimeout(() => {
      setBurst(true);
      store.activatePro(me!.id);
      toast.success(t.pro.paid, { icon: <Emoji3D src="/3d/star.png" size={22} /> });
      setTimeout(() => router.push("/account?tab=pro"), 1300);
    }, 1200);
  };

  const Feature = ({ children, on }: { children: React.ReactNode; on?: boolean }) => (
    <li className="flex items-start gap-2.5 text-[14.5px]">
      <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", on ? "bg-white/25 text-white" : "bg-stable-soft text-stable")}>
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      {children}
    </li>
  );

  return (
    <div className="min-h-[100svh] pb-32">
      <TopNav />
      <div className="mx-auto max-w-[960px] px-4 pt-28 sm:pt-32">
        <Reveal className="relative text-center">
          <Sparkles count={14} colors={["#ffd60a", "#5e5ce6", "#ff375f", "#0a84ff"]} />
          <motion.div className="mx-auto w-fit" animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
            <Emoji3D src="/3d/star.png" size={72} className="drop-shadow-[0_0_24px_rgba(255,200,0,0.7)]" />
          </motion.div>
          <h1 className="mx-auto mt-4 max-w-[640px] text-[36px] font-bold leading-[1.05] tracking-[-0.04em] sm:text-[52px]">{t.pro.title}</h1>
          <p className="mx-auto mt-3 max-w-[560px] text-[17px] text-label-2">{t.pro.subtitle}</p>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Reveal>
            <div className="card h-full rounded-[34px] p-7">
              <div className="text-[15px] font-semibold text-label-2">{t.pro.free}</div>
              <div className="mt-1 text-[40px] font-bold tracking-[-0.04em]">{t.pro.freePrice}</div>
              <ul className="mt-5 space-y-2.5">{t.pro.freeFeatures.map((x) => <Feature key={x}>{x}</Feature>)}</ul>
              {!isPro && me?.serviceId && <div className="mt-6 rounded-full bg-surface-2 py-2.5 text-center text-[14px] font-semibold text-label-2">{t.pro.current}</div>}
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <motion.div whileHover={{ y: -6, scale: 1.01 }} transition={{ type: "spring", stiffness: 260, damping: 20 }} className="relative h-full overflow-hidden rounded-[36px] p-[3px] shadow-[0_30px_80px_-30px_rgba(94,92,230,0.9)]">
            {/* animated glowing border */}
            <motion.div
              className="absolute -inset-[60%]"
              style={{ background: "conic-gradient(from 0deg, #ffd60a, #ff375f, #5e5ce6, #0a84ff, #30d158, #ffd60a)" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            />
            <div className="relative h-full overflow-hidden rounded-[33px] bg-gradient-to-br from-[#0a7cff] via-[#5e5ce6] to-[#ff2d78] p-7 text-white">
            <Sparkles count={20} />
            <motion.div
              className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              animate={{ left: ["-40%", "140%"] }}
              transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 1.6, ease: "easeInOut" }}
            />
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold text-white/85">PawLink Pro</span>
                <Emoji3D src="/3d/sparkles.png" size={30} />
              </div>
              <div className="mt-1 text-[40px] font-bold tracking-[-0.04em]">
                {t.pro.proPrice}<span className="text-[16px] font-medium text-white/75"> {t.pro.perMonth}</span>
              </div>
              <ul className="mt-5 space-y-2.5">{t.pro.proFeatures.map((x) => <Feature key={x} on>{x}</Feature>)}</ul>
              {isPro ? (
                <div className="mt-6 rounded-full bg-white/20 py-2.5 text-center text-[14px] font-semibold">{t.pro.current} ✓</div>
              ) : (
                <Button variant="white" size="lg" className="mt-6 w-full" onClick={choose}>{t.pro.choose}</Button>
              )}
            </div>
            </motion.div>
          </Reveal>
        </div>

        {burst && <Burst />}
        <p className="mt-6 text-center text-[14px] text-label-2">🐾 {t.pro.citizens}</p>

        <AnimatePresence>
          {checkout && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => !paying && setCheckout(false)}>
              <motion.div
                initial={{ y: 60, scale: 0.96 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
                className="glass-strong w-full max-w-[420px] rounded-[32px] p-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-[20px] font-bold">{t.pro.checkout}</h2>
                  <span className="flex items-center gap-1 text-[12px] text-label-2"><Lock className="h-3.5 w-3.5" /> Chargily</span>
                </div>
                <div className="mt-4 flex items-baseline justify-between rounded-[18px] bg-surface-2 p-4">
                  <span className="font-semibold">PawLink Pro · 1 {t.pro.perMonth.replace("/", "").trim()}</span>
                  <span className="text-[20px] font-bold">{t.pro.proPrice}</span>
                </div>
                <div className="mt-4 text-[13px] font-semibold text-label-2">{t.pro.method}</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["edahabia", "cib"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setMethod(m)} className={cn("rounded-[16px] p-3 text-[14px] font-bold transition-colors", method === m ? "bg-accent-soft text-accent ring-2 ring-accent" : "bg-surface-2")}>
                      {m === "edahabia" ? "Edahabia" : "CIB"}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-[12.5px] text-label-2">{t.pro.demoNote}</p>
                <Button size="lg" className="mt-4 w-full" disabled={paying} onClick={pay}>
                  {paying ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : t.pro.pay}
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {!me?.serviceId && (
          <div className="mt-8 text-center">
            <ButtonLink href="/login?mode=up" variant="tinted">{t.svc.claim}</ButtonLink>
          </div>
        )}
      </div>
    </div>
  );
}
