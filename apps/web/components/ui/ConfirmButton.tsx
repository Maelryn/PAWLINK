"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** A button for actions that can't be undone: the first tap asks "tap again to confirm" for 3 s. */
export function ConfirmButton({ onConfirm, children, className, armedClassName }: { onConfirm: () => void; children: React.ReactNode; className?: string; armedClassName?: string }) {
  const { t } = useI18n();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(id);
  }, [armed]);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
      className={cn("relative overflow-hidden transition-colors", className, armed && (armedClassName ?? "bg-urgent text-white"))}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={armed ? "a" : "b"} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.15 }} className="flex items-center justify-center gap-1.5">
          {armed ? t.life.sure : children}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
