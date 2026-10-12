"use client";

import { AnimatePresence, motion } from "motion/react";
import { Pencil, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { TAGS } from "@/components/report/ReportFlow";
import { Button } from "@/components/ui/Button";
import { useMounted } from "@/components/ui/primitives";
import { deleteCase, proposeCaseEdit } from "@/lib/cases";
import { useI18n } from "@/lib/i18n";
import type { Case } from "@/lib/types";
import { useHideTabBar } from "@/lib/ui";
import { cn } from "@/lib/utils";

/** The reporter's own tools on a case: edit (a moderator approves changes to a public report) and delete. */
export function ReporterTools({ c }: { c: Case }) {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [editing, setEditing] = useState(params.get("edit") === "1");
  const [asking, setAsking] = useState(false);
  return (
    <>
      {c.pendingEdit && (
        <div className="mt-4 rounded-[16px] bg-monitor-soft px-3.5 py-2.5 text-[13px]">
          <span className="font-semibold text-monitor">{t.post.pending}</span> <span className="text-label-2">· {t.post.pendingBody}</span>
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <Button variant="tinted" className="flex-1" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4" /> {t.verify.edit}
        </Button>
        <Button variant="glass" className="text-urgent" onClick={() => setAsking(true)} aria-label={t.verify.delete}>
          <Trash2 className="h-4 w-4" /> <span className="max-sm:hidden">{t.verify.delete}</span>
        </Button>
      </div>
      <Sheet open={asking} onClose={() => setAsking(false)}>
        <p className="text-[16px] font-semibold leading-snug">{t.verify.deleteAsk}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="glass" size="lg" onClick={() => setAsking(false)}>{t.verify.cancel}</Button>
          <Button
            variant="danger"
            size="lg"
            onClick={() => {
              deleteCase(c);
              toast.success(t.verify.deleted);
              router.replace("/account?tab=reports");
            }}
          >
            {t.verify.delete}
          </Button>
        </div>
      </Sheet>
      <Sheet open={editing} onClose={() => setEditing(false)}>
        <EditForm c={c} onDone={() => setEditing(false)} />
      </Sheet>
    </>
  );
}

function EditForm({ c, onDone }: { c: Case; onDone: () => void }) {
  const { t } = useI18n();
  const [desc, setDesc] = useState(c.pendingEdit?.description ?? c.description);
  const [tags, setTags] = useState<string[]>(c.pendingEdit?.conditionTags ?? c.conditionTags);
  const toggle = (x: string) => setTags(tags.includes(x) ? tags.filter((y) => y !== x) : [...tags, x]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        proposeCaseEdit(c, { description: desc.trim(), conditionTags: tags });
        toast.success(c.moderation === "pending" ? t.acct.saved : t.post.sent);
        onDone();
      }}
    >
      <div className="text-[19px] font-bold tracking-[-0.02em]">{t.verify.editTitle}</div>
      <div className="mt-3 flex max-h-[146px] flex-wrap gap-1.5 overflow-y-auto no-scrollbar">
        {TAGS.map((x) => (
          <button key={x} type="button" onClick={() => toggle(x)} className={cn("h-8 rounded-full px-3 text-[13px] font-semibold transition-colors", tags.includes(x) ? "bg-label text-bg" : "bg-surface-2")}>
            {t.common.tags[x]}
          </button>
        ))}
      </div>
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} className="mt-3 w-full resize-none rounded-[18px] bg-surface-2 p-3.5 text-[16px] leading-relaxed outline-none ring-accent/40 focus:ring-2" />
      <Button type="submit" size="lg" className="mt-3 w-full" disabled={desc.trim().length < 5}>
        {c.moderation === "pending" ? t.acct.save : t.post.send}
      </Button>
    </form>
  );
}

/** Bottom sheet on phones, centered card on desktop. */
function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const { t } = useI18n();
  const mounted = useMounted();
  useHideTabBar(open);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center">
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[520px] rounded-t-[30px] bg-surface p-5 pb-[max(20px,env(safe-area-inset-bottom))] md:rounded-[30px]"
          >
            <button type="button" onClick={onClose} className="absolute end-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-surface-2" aria-label={t.common.close}>
              <X className="h-4 w-4" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
