"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Emoji3D } from "@/components/ui/primitives";
import { Sparkles } from "@/components/ui/Sparkles";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { openPaywall, usePaywallOpen } from "@/lib/ui";
import { Paywall } from "./Paywall";

const PROMO_KEY = "pawlink.proPromo";
const PROMO_EVERY = 24 * 3_600_000; // remind at most once a day

/** Paywall sheet (opened with openPaywall()) + a friendly Pro reminder for businesses without Pro. */
export function ProHost() {
  const open = usePaywallOpen();
  const { t } = useI18n();
  const me = useSession();
  const path = usePathname();
  const [promo, setPromo] = useState(false);

  const eligible = !!me?.serviceId && !(me.pro && new Date(me.pro.until) > new Date());
  const quietPage = ["/pro", "/login", "/map", "/report"].some((p) => path.startsWith(p));

  useEffect(() => {
    if (!eligible || quietPage) return;
    let last = 0;
    try {
      last = Number(localStorage.getItem(PROMO_KEY) ?? 0);
    } catch {}
    if (Date.now() - last < PROMO_EVERY) return;
    const id = setTimeout(() => setPromo(true), 2500);
    return () => clearTimeout(id);
  }, [eligible, quietPage]);

  const dismiss = () => {
    setPromo(false);
    try {
      localStorage.setItem(PROMO_KEY, String(Date.now()));
    } catch {}
  };

  return (
    <>
      {/* reminder card */}
      <AnimatePresence>
        {promo && !open && (
          <motion.div
            initial={{ y: 140, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 140, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="fixed inset-x-3 bottom-[92px] z-[65] mx-auto max-w-[420px] overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0a7cff] via-[#5e5ce6] to-[#ff2d78] p-[2px] shadow-[0_24px_60px_-20px_rgba(94,92,230,0.9)] md:bottom-6"
          >
            <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#0a7cff] via-[#5e5ce6] to-[#ff2d78] p-4 text-white">
              <Sparkles count={12} />
              <div className="relative flex items-center gap-3">
                <motion.span animate={{ rotate: [0, -12, 12, 0], scale: [1, 1.15, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                  <Emoji3D src="/3d/star.png" size={44} />
                </motion.span>
                <div className="min-w-0 flex-1">
                  <div className="text-[16px] font-bold">{t.pay.promoTitle}</div>
                  <div className="text-[12.5px] leading-snug text-white/85">{t.pay.promoBody}</div>
                </div>
              </div>
              <div className="relative mt-3 flex gap-2">
                <button type="button" onClick={dismiss} className="h-10 flex-1 rounded-full bg-white/20 text-[14px] font-semibold">{t.pay.later}</button>
                <button type="button" onClick={() => { dismiss(); openPaywall(); }} className="h-10 flex-[1.4] rounded-full bg-white text-[14px] font-bold text-[#3d3bd6]">{t.pay.promoCta}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* paywall sheet: full screen on phones, centered card on desktop */}
      <AnimatePresence>
        {open && (
          <motion.div key="pw" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center" onClick={() => openPaywall(false)}>
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="h-[100svh] w-full overflow-hidden md:h-[min(760px,92svh)] md:w-[430px] md:rounded-[38px] md:shadow-2xl"
            >
              <Paywall onClose={() => openPaywall(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
