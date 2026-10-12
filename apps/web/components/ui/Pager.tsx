"use client";

import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Page numbers under long lists: ‹ 1 2 3 › (with … when there are many). */
export function Pager({ page, pages, onChange, id }: { page: number; pages: number; onChange: (p: number) => void; id: string }) {
  const { t } = useI18n();
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  const go = (n: number) => {
    onChange(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const btn = "flex h-11 min-w-11 items-center justify-center rounded-full text-[15px] font-semibold transition-transform active:scale-90";
  return (
    <nav aria-label="pages" className="mt-8 flex items-center justify-center gap-1">
      <button type="button" disabled={page === 1} onClick={() => go(page - 1)} className={cn(btn, "bg-surface-2 disabled:opacity-35")} aria-label={t.common.back}>
        <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
      </button>
      {nums.map((n, i) => (
        <span key={n} className="flex items-center">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-label-3">…</span>}
          <button type="button" onClick={() => go(n)} aria-current={n === page ? "page" : undefined} className={cn(btn, "relative px-3", n === page ? "text-white" : "text-label")}>
            {n === page && <motion.span layoutId={`pager-${id}`} className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 460, damping: 34 }} />}
            <span className="relative tabular-nums">{n}</span>
          </button>
        </span>
      ))}
      <button type="button" disabled={page === pages} onClick={() => go(page + 1)} className={cn(btn, "bg-surface-2 disabled:opacity-35")} aria-label={t.common.next}>
        <ChevronRight className="h-5 w-5 rtl:rotate-180" />
      </button>
    </nav>
  );
}
