"use client";

import { AnimatePresence, motion } from "motion/react";
import { Link2, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* Share a case or an animal. Phones open the system share sheet (WhatsApp, Messenger, SMS…);
   computers get WhatsApp, Facebook and "copy link", since rescue in Algeria lives in those groups. */

export function ShareButton({ title, text, className, size = "md" }: { title: string; text?: string; className?: string; size?: "md" | "lg" }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const url = () => window.location.href;
  const message = () => `${text ?? title}\n${url()}`;

  const onClick = async () => {
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (touch && navigator.share) {
      try {
        await navigator.share({ title, text: text ?? title, url: url() });
      } catch {}
      return;
    }
    setOpen((o) => !o);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url());
      toast.success(t.share.copied);
    } catch {
      toast(url());
    }
    setOpen(false);
  };

  const item = "flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-[14px] font-medium hover:bg-black/5 dark:hover:bg-white/10";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onClick}
        aria-label={t.common.share}
        aria-expanded={open}
        className={cn("flex items-center justify-center rounded-full transition-transform active:scale-90", size === "lg" ? "h-11 w-11" : "h-10 w-10", className)}
      >
        <Share2 className="h-[18px] w-[18px]" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -2, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            style={{ transformOrigin: "top right" }}
            className="glass-strong absolute end-0 top-12 z-50 w-56 overflow-hidden rounded-[20px] p-1.5"
          >
            <a className={item} href={`https://wa.me/?text=${encodeURIComponent(message())}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden><path fill="#25D366" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3.1.1.1.6-.1 1.1Z" /></svg>
              WhatsApp
            </a>
            <a className={item} href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden><path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" /></svg>
              Facebook
            </a>
            <button type="button" className={item} onClick={copy}>
              <Link2 className="h-4 w-4 text-label-2" /> {t.share.copy}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
