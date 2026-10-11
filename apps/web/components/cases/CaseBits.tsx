"use client";

import { useCaseText } from "@/lib/i18n/content";

import { offerHelp } from "@/lib/cases";

import { AnimatePresence, motion } from "motion/react";
import { Check, Clock, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Avatar, CasePhoto, Emoji3D, TimeAgo, TriageBadge } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import { HELP_EMOJI, SPECIES_EMOJI } from "@/lib/species";
import type { Case, HelpType } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CaseRow({ c, distance, active, onClick }: { c: Case; distance?: number; active?: boolean; onClick?: () => void }) {
  const ct = useCaseText();
  const { t } = useI18n();
  return (
    <motion.button
      layout
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "flex w-full items-center gap-3 rounded-[22px] p-2.5 text-start transition-colors",
        active ? "bg-accent-soft" : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
      )}
    >
      <CasePhoto photo={c.photos[0]} emoji={SPECIES_EMOJI[c.species]} emojiSize={34} sizes="64px" className="h-16 w-16 shrink-0 rounded-[16px]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <TriageBadge triage={c.triage} size="sm" />
          {(c.count ?? 1) > 1 && <span className="text-[11px] font-semibold text-label-2">×{c.count}</span>}
        </div>
        <div className="mt-1 truncate text-[15px] font-semibold tracking-[-0.01em]">{ct(c).title}</div>
        <div className="mt-0.5 flex items-center gap-2 truncate text-[12.5px] text-label-2">
          <span className="flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3 shrink-0" />
            {distance !== undefined ? t.common.km(distance) : c.location.address}
          </span>
          <span>·</span>
          <span className="flex shrink-0 items-center gap-1">
            <Clock className="h-3 w-3" />
            <TimeAgo iso={c.createdAt} />
          </span>
        </div>
      </div>
      {c.helpers.length > 0 && (
        <div className="flex shrink-0 -space-x-2 rtl:space-x-reverse">
          {c.helpers.slice(0, 2).map((h) => (
            <Avatar key={h.user.id} name={h.user.name} size={26} ring />
          ))}
        </div>
      )}
    </motion.button>
  );
}

/** Horizontal card used in the mobile map carousel (travel-app style). */
export function CaseCard({ c, distance, onClick, active }: { c: Case; distance?: number; onClick?: () => void; active?: boolean }) {
  const ct = useCaseText();
  const { t } = useI18n();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      animate={{ scale: active ? 1 : 0.94, opacity: active ? 1 : 0.85 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className="glass-strong flex w-[290px] shrink-0 snap-center items-center gap-3 rounded-[26px] p-2.5 text-start"
    >
      <CasePhoto photo={c.photos[0]} emoji={SPECIES_EMOJI[c.species]} emojiSize={40} sizes="80px" className="h-[76px] w-[76px] shrink-0 rounded-[18px]" />
      <div className="min-w-0 flex-1">
        <TriageBadge triage={c.triage} size="sm" />
        <div className="mt-1 line-clamp-2 text-[14.5px] font-semibold leading-tight">{ct(c).title}</div>
        <div className="mt-1 truncate text-[12px] text-label-2">
          {distance !== undefined ? t.common.km(distance) : c.location.address} · <TimeAgo iso={c.createdAt} />
        </div>
      </div>
    </motion.button>
  );
}

/** "I can help" picker. */
export function HelpPicker({ c, onDone }: { c: Case; onDone?: () => void }) {
  const { t } = useI18n();
  const user = useSession();
  const router = useRouter();
  const [picked, setPicked] = useState<HelpType | null>(null);
  const options: HelpType[] = ["transport", "medical", "foster", "food", "search", "boarding", "funds"];
  return (
    <div>
      <div className="text-[19px] font-bold tracking-[-0.02em]">{t.case.helpTitle}</div>
      <p className="mt-1 text-[13.5px] text-label-2">{t.case.helpBody}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {options.map((h) => {
          const on = picked === h;
          return (
            <motion.button
              key={h}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setPicked(h)}
              className={cn(
                "relative flex items-center gap-2.5 rounded-[18px] border p-3 text-start text-[14px] font-semibold transition-colors",
                on ? "border-accent bg-accent-soft" : "border-separator bg-surface hover:bg-surface-2",
              )}
            >
              <Emoji3D src={HELP_EMOJI[h]} size={30} />
              {t.common.help[h]}
              <AnimatePresence>
                {on && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute end-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white"
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
      <Button
        className="mt-4 w-full"
        size="lg"
        disabled={!!user && !picked}
        onClick={async () => {
          if (!picked) return;
          if (!user) return router.push(`/login?next=/cases/${c.id}`);
          const r = await offerHelp(c, picked, user);
          if (!r.ok) return toast.error(t.auth.errors[r.code] ?? r.message ?? t.auth.errors.UNKNOWN);
          toast.success(t.case.helpThanks, { icon: <Emoji3D src="/3d/hearthands.png" size={22} /> });
          onDone?.();
        }}
      >
        {user ? t.case.helpSend : t.account.needLogin}
      </Button>
    </div>
  );
}

export function CaseLink({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={`/cases/${id}`} className={className}>
      {children}
    </Link>
  );
}
