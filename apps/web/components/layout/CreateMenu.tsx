"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Emoji3D, useMounted } from "@/components/ui/primitives";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { proActive, useStore } from "@/lib/store";
import { openPaywall } from "@/lib/ui";
import { cn } from "@/lib/utils";

export type CreateItem = { id: string; href: string; emoji: string; bg: string; title: string; sub: string; pro?: boolean };

/** What "+" can create for this account: report and adoption for everyone, "My service" for businesses. */
export function useCreateItems() {
  const { t } = useI18n();
  const me = useSession();
  const myService = useStore((s) => s.services).find((x) => x.id === me?.serviceId);
  const items: CreateItem[] = [
    { id: "report", href: "/report", emoji: "/3d/camera.png", bg: "#ffe1dc", title: t.create.report, sub: t.create.reportSub },
    { id: "adopt", href: "/adopt/new", emoji: "/3d/home.png", bg: "#ffe0ec", title: t.create.adopt, sub: t.create.adoptSub },
  ];
  if (myService) items.push({ id: "service", href: "/account?tab=pro", emoji: "/3d/stethoscope.png", bg: "#dcecff", title: t.create.service, sub: t.create.serviceSub, pro: !proActive(me) });
  // regular accounts: a soft way to become a verified professional (not in the long-press fan)
  const extra: CreateItem | null =
    me && !me.serviceId && me.role !== "admin" ? { id: "biz", href: "/account?tab=profile#business", emoji: "/3d/star.png", bg: "#fff1c7", title: t.create.pro, sub: t.create.proSub } : null;
  return { items, extra, proAd: !!myService && myService.status === "approved" && !proActive(me) };
}

const vibrate = (ms: number) => {
  try {
    navigator.vibrate?.(ms);
  } catch {}
};

/** Phone tab bar "+": tap opens a sheet; hold, slide to a card, release to open it (shortcut). */
export function CreateFab({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const { t } = useI18n();
  const mounted = useMounted();
  const router = useRouter();
  const { items, extra, proAd } = useCreateItems();
  const [mode, setMode] = useState<null | "sheet" | "hold">(null);
  const [hover, setHover] = useState(-1);
  const modeRef = useRef(mode);
  const hoverRef = useRef(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const ignoreClick = useRef(0);
  useEffect(() => {
    modeRef.current = mode;
    if (!mode) {
      hoverRef.current = -1;
    }
    onOpenChange?.(!!mode);
  }, [mode, onOpenChange]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  // close on route change / back gesture
  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMode(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  const go = (href: string) => {
    modeRef.current = null;
    setMode(null);
    setHover(-1);
    hoverRef.current = -1;
    router.push(href);
  };

  const pick = (x: number, y: number) => {
    let found = -1;
    cards.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (x > r.left - 14 && x < r.right + 14 && y > r.top - 24 && y < r.bottom + 24) found = i;
    });
    if (found !== hoverRef.current) {
      hoverRef.current = found;
      setHover(found);
      if (found >= 0) vibrate(8);
    }
  };

  const n = items.length;
  const step = n > 2 ? 104 : 118;

  return (
    <>
      <motion.button
        type="button"
        aria-label={t.create.title}
        aria-haspopup="dialog"
        aria-expanded={!!mode}
        onPointerDown={(e) => {
          if (modeRef.current) return; // open already: a tap closes it (pointerup below)
          const start = { x: e.clientX, y: e.clientY };
          const hold = () => {
            if (timer.current) clearTimeout(timer.current);
            if (modeRef.current === "hold") return;
            modeRef.current = "hold";
            setHover(-1);
            setMode("hold");
            vibrate(14);
          };
          timer.current = setTimeout(hold, 280);
          // follow the finger on the whole window: on phones the gesture leaves the button right away
          const move = (ev: PointerEvent) => {
            if (modeRef.current !== "hold" && start.y - ev.clientY > 12) hold(); // sliding up = shortcut, no need to wait
            if (modeRef.current === "hold") pick(ev.clientX, ev.clientY);
          };
          const noScroll = (ev: TouchEvent) => modeRef.current === "hold" && ev.cancelable && ev.preventDefault();
          const end = (ev: PointerEvent) => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", end);
            window.removeEventListener("pointercancel", end);
            window.removeEventListener("touchmove", noScroll);
            if (timer.current) clearTimeout(timer.current);
            if (modeRef.current === "hold") {
              const i = hoverRef.current;
              // released on a card: open it. Elsewhere (or the browser interrupted the gesture): the cards stay, tap one
              if (ev.type === "pointerup" && i >= 0) go(items[i].href);
              ignoreClick.current = Date.now() + 450; // the click that follows this release must not close the cards
              return;
            }
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", end);
          window.addEventListener("pointercancel", end);
          window.addEventListener("touchmove", noScroll, { passive: false });
        }}
        onClick={() => {
          if (Date.now() < ignoreClick.current) return;
          setMode(modeRef.current ? null : "sheet"); // tap (or keyboard) toggles the sheet
        }}
        onContextMenu={(e) => e.preventDefault()}
        whileTap={{ scale: 0.88 }}
        className="relative z-[72] flex h-12 w-12 touch-none select-none items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_20px_-6px_var(--accent)] [-webkit-touch-callout:none]"
      >
        <motion.span animate={{ rotate: mode ? 45 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 26 }}>
          <Plus className="h-6 w-6" strokeWidth={2.6} />
        </motion.span>
        {/* breathing ring: hints the button does more than one thing */}
        {!mode && <span aria-hidden className="pointer-events-none absolute inset-0 animate-[fab-ring_3.2s_ease-out_infinite] rounded-full ring-2 ring-accent" />}
      </motion.button>

      {mounted && createPortal(
      <AnimatePresence>
        {mode && (
          <motion.div
            key="dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMode(null)}
            className="fixed inset-0 z-[70] bg-black/35 backdrop-blur-[6px]"
          />
        )}

        {/* long press: cards fan out above the button */}
        {mode === "hold" && (
          <motion.div key="fan" className="pointer-events-none fixed inset-x-0 bottom-[calc(max(12px,env(safe-area-inset-bottom))+84px)] z-[71] flex h-[190px] justify-center">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute -top-12 rounded-full bg-black/55 px-4 py-2 text-[13px] font-semibold text-white">
              {hover >= 0 ? t.create.release : t.create.slide}
            </motion.div>
            {items.map((it, i) => {
              const k = i - (n - 1) / 2;
              const on = hover === i;
              return (
                <motion.div
                  key={it.id}
                  ref={(el) => {
                    cards.current[i] = el;
                  }}
                  role="button"
                  tabIndex={0}
                  onClick={() => go(it.href)}
                  initial={{ x: 0, y: 150, rotate: 0, scale: 0.3, opacity: 0 }}
                  animate={{ x: k * step, y: Math.abs(k) * 16 + (on ? -18 : 0), rotate: k * 9, scale: on ? 1.1 : hover >= 0 ? 0.92 : 1, opacity: 1 }}
                  exit={{ x: 0, y: 150, rotate: 0, scale: 0.3, opacity: 0, transition: { duration: 0.18 } }}
                  transition={{ type: "spring", stiffness: 420, damping: 24, delay: i * 0.035 }}
                  className={cn(
                    "pointer-events-auto absolute bottom-0 flex w-[96px] cursor-pointer flex-col items-center gap-2 rounded-[26px] bg-surface px-2 pb-3 pt-4 text-center shadow-[0_18px_40px_-14px_rgba(0,0,0,0.5)]",
                    on && "ring-[3px] ring-accent",
                  )}
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-[18px]" style={{ background: it.bg }}>
                    <Emoji3D src={it.emoji} size={38} />
                  </span>
                  <span className="text-[12.5px] font-bold leading-tight">{it.title}</span>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* tap: a sheet with the same choices */}
        {mode === "sheet" && (
          <motion.div
            key="sheet"
            role="dialog"
            aria-label={t.create.title}
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            exit={{ y: "110%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="fixed inset-x-3 bottom-[calc(max(12px,env(safe-area-inset-bottom))+76px)] z-[71] mx-auto max-w-[420px] rounded-[30px] bg-surface p-3 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)]"
          >
            <div className="px-2 pb-2 pt-1 text-[17px] font-bold tracking-[-0.02em]">{t.create.title}</div>
            <div className="space-y-1.5">
              {[...items, ...(extra ? [extra] : [])].map((it, i) => (
                <motion.button
                  key={it.id}
                  type="button"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 + i * 0.045, type: "spring", stiffness: 420, damping: 30 }}
                  onClick={() => go(it.href)}
                  className={cn("flex w-full items-center gap-3 rounded-[20px] p-2.5 text-start transition-transform active:scale-[0.98]", it.id === "biz" ? "mt-2 bg-surface-2/70" : "bg-surface-2")}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]" style={{ background: it.bg }}>
                    <Emoji3D src={it.emoji} size={32} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[15.5px] font-semibold">
                      {it.title}
                      {it.pro && <span className="rounded-full bg-gradient-to-r from-[#0a7cff] to-[#5e5ce6] px-1.5 py-px text-[10px] font-bold text-white">PRO</span>}
                    </span>
                    <span className="block truncate text-[13px] text-label-2">{it.sub}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-label-3 rtl:rotate-180" />
                </motion.button>
              ))}
            </div>
            {proAd && (
              <button
                type="button"
                onClick={() => {
                  setMode(null);
                  openPaywall();
                }}
                className="mt-2 flex w-full items-center gap-2.5 rounded-[18px] bg-gradient-to-r from-[#0a7cff] via-[#5e5ce6] to-[#ff2d78] px-3.5 py-3 text-start text-[14px] font-semibold text-white"
              >
                <Emoji3D src="/3d/sparkles.png" size={24} /> <span className="flex-1">{t.create.proAd}</span> <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </button>
            )}
            <p className="px-2 pb-0.5 pt-2.5 text-center text-[12px] text-label-2">{t.create.hint}</p>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
      )}
    </>
  );
}

/** Desktop: the same choices in a menu next to the account. */
export function CreateMenuDesktop() {
  const { t } = useI18n();
  const router = useRouter();
  const { items, extra, proAd } = useCreateItems();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const f = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", f);
    window.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("pointerdown", f);
      window.removeEventListener("keydown", k);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative ms-1 hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[14px] font-semibold text-white shadow-[0_6px_16px_-6px_var(--accent)] transition-transform active:scale-95"
      >
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 26 }}>
          <Plus className="h-4 w-4" strokeWidth={2.6} />
        </motion.span>
        {t.create.cta}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            style={{ transformOrigin: "top right" }}
            className="glass-strong absolute end-0 top-12 z-50 w-[320px] rounded-[24px] p-2"
          >
            {[...items, ...(extra ? [extra] : [])].map((it) => (
              <button
                key={it.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  router.push(it.href);
                }}
                className="flex w-full items-center gap-3 rounded-[16px] p-2 text-start transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]" style={{ background: it.bg }}>
                  <Emoji3D src={it.emoji} size={26} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[14.5px] font-semibold">
                    {it.title}
                    {it.pro && <span className="rounded-full bg-gradient-to-r from-[#0a7cff] to-[#5e5ce6] px-1.5 py-px text-[10px] font-bold text-white">PRO</span>}
                  </span>
                  <span className="block truncate text-[12.5px] text-label-2">{it.sub}</span>
                </span>
              </button>
            ))}
            {proAd && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openPaywall();
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-[16px] bg-gradient-to-r from-[#0a7cff] via-[#5e5ce6] to-[#ff2d78] px-3 py-2.5 text-start text-[13.5px] font-semibold text-white"
              >
                <Emoji3D src="/3d/sparkles.png" size={20} /> {t.create.proAd}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
