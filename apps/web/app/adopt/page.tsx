"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { TopNav } from "@/components/layout/TopNav";

import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { Emoji3D } from "@/components/ui/primitives";
import { LIVESTOCK } from "@/lib/species";
import type { Species } from "@/lib/types";
import type { Dict } from "@/lib/i18n/en";
import { cn } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/Button";
import { Heart, PawPrint, Plus } from "lucide-react";

type Cat = "all" | "dog" | "cat" | "livestock" | "other";
const CATS: { id: Cat; label: (t: Dict) => string; pet?: { src: string; bg: string } }[] = [
  { id: "all", label: (t) => t.adopt.filterAll },
  { id: "dog", label: (t) => t.common.species.dog, pet: { src: "/3d/dog.png", bg: "#cfe5ff" } },
  { id: "cat", label: (t) => t.common.species.cat, pet: { src: "/3d/cat.png", bg: "#ffd8e4" } },
  { id: "livestock", label: (t) => t.common.livestock, pet: { src: "/3d/sheep.png", bg: "#cdeedd" } },
  { id: "other", label: (t) => t.common.species.other, pet: { src: "/3d/rabbit.png", bg: "#e3dcff" } },
];
const matches = (c: Cat, s: Species) =>
  c === "all" || (c === "livestock" ? LIVESTOCK.includes(s) : c === "other" ? !LIVESTOCK.includes(s) && s !== "dog" && s !== "cat" : s === c);

export default function AdoptPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Cat>("all");
  const list = useStore((s) => s.adoptions).filter((a) => a.status === "approved" && matches(filter, a.species));

  return (
    <div className="min-h-[100svh] pb-32">
      <TopNav />
      <div className="mx-auto max-w-[1180px] px-4 pt-28 sm:pt-32">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[30px] font-black sm:text-[38px]">{t.adopt.title}</h1>
          <ButtonLink href="/adopt/new" size="sm">
            <Plus className="h-4 w-4" strokeWidth={2.6} /> {t.market.post}
          </ButtonLink>
        </div>
        <p className="mt-1 max-w-[560px] text-[15px] text-label-2">{t.adopt.subtitle}</p>

        {/* categories with real pet photos (same pattern as Services) */}
        <div className="-mx-4 mt-3 flex gap-4 overflow-x-auto px-4 py-2 no-scrollbar">
          {CATS.map((c) => {
            const on = filter === c.id;
            return (
              <button key={c.id} type="button" onClick={() => setFilter(c.id)} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5">
                <span className={cn("rounded-full transition-shadow", on && "ring-[3px] ring-accent ring-offset-2 ring-offset-bg")}>
                  {c.pet ? (
                    <span className="flex h-[62px] w-[62px] items-center justify-center rounded-full" style={{ background: c.pet.bg }}><Emoji3D src={c.pet.src} size={38} /></span>
                  ) : (
                    <span className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-surface-2"><PawPrint className="h-6 w-6" /></span>
                  )}
                </span>
                <span className={cn("max-w-full truncate text-[12px]", on ? "font-bold text-accent" : "font-medium text-label-2")}>{c.label(t)}</span>
              </button>
            );
          })}
        </div>

        <motion.div layout className="mt-8 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {list.map((a, i) => (
              <motion.div key={a.id} layout initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", stiffness: 280, damping: 26, delay: Math.min(i * 0.04, 0.3) }}>
                <Link href={`/adopt/${a.id}`} className="group block active:scale-[0.98]">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[24px] bg-surface-2 shadow-[var(--card-shadow)]">
                    <Image src={a.photos[0]} alt={a.name} fill unoptimized={a.photos[0].startsWith("data:")} sizes="(min-width:1024px) 280px, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                    <span className="glass absolute end-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full">
                      <Heart className="h-[18px] w-[18px] text-[#ff2d55]" />
                    </span>
                    <span className="absolute bottom-2.5 start-2.5 flex items-center gap-1 rounded-full bg-white/90 py-0.5 pe-2.5 ps-1 text-[12px] font-bold text-[#1d1d1f]">
                      {t.adopt.age(a.ageMonths)}
                    </span>
                  </div>
                  <div className="px-1 pt-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-display text-[18px] font-extrabold">{a.name}</span>
                      <span className="shrink-0 text-[13px] font-semibold text-label-2">{a.sex === "male" ? "♂" : "♀"}</span>
                    </div>
                    <div className="truncate text-[12.5px] text-label-2">{a.breed} · {a.location.address}</div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
