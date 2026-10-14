"use client";

import { AnimatePresence, motion } from "motion/react";
import { Lock, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Emoji3D, useMounted } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import { store } from "@/lib/store";
import type { AdoptionProfile, AdoptionRequest, User } from "@/lib/types";
import { cn } from "@/lib/utils";

const HOUSING: { id: AdoptionRequest["housing"]; emoji: string; bg: string }[] = [
  { id: "apartment", emoji: "/3d/home.png", bg: "#e3efff" },
  { id: "house", emoji: "/3d/seedling.png", bg: "#e2f8e6" },
  { id: "farm", emoji: "/3d/cow.png", bg: "#fff1dc" },
];

/** The adoption request: a sheet on phones, a centered card on desktop, big tap targets everywhere. */
export function AdoptRequestSheet({ a, me, open, onClose }: { a: AdoptionProfile; me: User; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const mounted = useMounted();
  const [msg, setMsg] = useState("");
  const [housing, setHousing] = useState<AdoptionRequest["housing"]>("house");
  const [exp, setExp] = useState(true);
  if (!mounted) return null;
  const ready = msg.trim().length >= 10;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[85] flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center md:p-6">
          <motion.form
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (!ready) return;
              store.sendRequest({ id: `rq${Date.now()}`, adoptionId: a.id, from: { id: me.id, name: me.name, avatar: "" }, fromPhone: me.phone, message: msg.trim(), housing, experience: exp, status: "sent", createdAt: new Date().toISOString() });
              toast.success(t.market.sent, { icon: <Emoji3D src="/3d/love.png" size={22} /> });
              onClose();
            }}
            className="relative max-h-[92svh] w-full overflow-y-auto rounded-t-[32px] bg-bg px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 md:max-w-[520px] md:rounded-[32px] md:pt-6"
          >
            <span className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-label-3/40 md:hidden" />
            <button type="button" onClick={onClose} className="absolute end-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2" aria-label={t.common.close}>
              <X className="h-5 w-5" />
            </button>

            {/* who you're asking for */}
            <div className="flex items-center gap-3.5 pe-12">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[20px]">
                <Image src={a.photos[0]} alt={a.name} fill unoptimized={a.photos[0].startsWith("data:")} sizes="64px" className="object-cover" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-label-2">{t.market.requestTitle}</div>
                <div className="truncate text-[24px] font-black leading-tight tracking-[-0.02em]">{a.name} 🐾</div>
              </div>
            </div>
            <p className="mt-3 text-[14px] leading-snug text-label-2">{t.market.requestBody}</p>

            {/* home: three big tiles */}
            <div className="mt-5 text-[15px] font-bold">{t.market.homeTitle}</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {HOUSING.map((h) => {
                const on = housing === h.id;
                return (
                  <motion.button
                    key={h.id}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setHousing(h.id)}
                    aria-pressed={on}
                    className={cn("flex flex-col items-center gap-1.5 rounded-[22px] px-1.5 py-3 text-center transition-shadow", on ? "ring-[3px] ring-accent" : "ring-1 ring-separator")}
                    style={{ background: on ? h.bg : undefined }}
                  >
                    <Emoji3D src={h.emoji} size={40} />
                    <span className={cn("text-[13px] font-semibold leading-tight", on ? "text-[#1d1d1f]" : "text-label")}>{t.market.housing[h.id]}</span>
                  </motion.button>
                );
              })}
            </div>

            {/* experience: an iOS switch */}
            <button type="button" onClick={() => setExp((v) => !v)} aria-pressed={exp} className="mt-3 flex min-h-14 w-full items-center gap-3 rounded-[20px] bg-surface p-3.5 text-start">
              <Emoji3D src="/3d/paw.png" size={30} />
              <span className="flex-1 text-[15px] font-semibold">{t.market.experience}</span>
              <span className={cn("relative h-[31px] w-[51px] shrink-0 rounded-full p-[2px] transition-colors", exp ? "bg-stable" : "bg-label-3/50")}>
                <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 34 }} className={cn("block h-[27px] w-[27px] rounded-full bg-white shadow", exp && "ms-auto")} />
              </span>
            </button>

            {/* message */}
            <div className="mt-5 text-[15px] font-bold">{t.market.aboutYou}</div>
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={4}
              placeholder={t.market.message}
              className="mt-2 w-full resize-none rounded-[20px] bg-surface p-4 text-[16px] leading-relaxed outline-none ring-accent/40 placeholder:text-label-3 focus:ring-2"
            />

            {/* the phone rule, said plainly */}
            <div className="mt-3 flex items-start gap-2.5 rounded-[18px] bg-accent-soft p-3.5 text-[13px] leading-snug text-label">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>
                {me.phone && <b dir="ltr">{me.phone} · </b>}
                {t.market.phoneRule}
              </span>
            </div>

            <Button type="submit" size="lg" className="mt-5 h-14 w-full text-[17px]" disabled={!ready}>
              {t.market.send}
            </Button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
