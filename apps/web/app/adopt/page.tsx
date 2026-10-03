"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { Reveal } from "@/components/motion";
import { Emoji3D, Segmented } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { ButtonLink } from "@/components/ui/Button";
import { Plus } from "lucide-react";
import { SPECIES_EMOJI } from "@/lib/species";

export default function AdoptPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<"all" | "dog" | "cat">("all");
  const list = useStore((s) => s.adoptions).filter((a) => a.status === "approved" && (filter === "all" || a.species === filter));

  return (
    <div className="min-h-[100svh] pb-32">
      <TopNav />
      <div className="mx-auto max-w-[1180px] px-4 pt-28 sm:pt-32">
        <Reveal className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-[15px] font-semibold text-[#ff2d55]">
              <Emoji3D src="/3d/heart.png" size={22} /> {t.nav.adopt}
            </div>
            <h1 className="mt-1 text-[40px] font-black leading-[1.02] sm:text-[56px]">{t.adopt.title}</h1>
            <p className="mt-3 max-w-[560px] text-[17px] text-label-2">{t.adopt.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href="/adopt/new" size="sm">
            <Plus className="h-4 w-4" strokeWidth={2.6} /> {t.market.post}
          </ButtonLink>
          <Segmented
            layoutId="adopt-seg"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: t.adopt.filterAll },
              { value: "dog", label: <><Emoji3D src="/3d/dog.png" size={18} />{t.common.species.dog}</> },
              { value: "cat", label: <><Emoji3D src="/3d/cat.png" size={18} />{t.common.species.cat}</> },
            ]}
          />
          </div>
        </Reveal>

        <motion.div layout className="mt-8 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {list.map((a, i) => (
              <motion.div key={a.id} layout initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", stiffness: 280, damping: 26, delay: Math.min(i * 0.04, 0.3) }}>
                <Link href={`/adopt/${a.id}`} className="group block active:scale-[0.98]">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[24px] bg-surface-2 shadow-[var(--card-shadow)]">
                    <Image src={a.photos[0]} alt={a.name} fill unoptimized={a.photos[0].startsWith("data:")} sizes="(min-width:1024px) 280px, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                    <span className="glass absolute end-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full">
                      <Emoji3D src="/3d/heart.png" size={20} />
                    </span>
                    <span className="absolute bottom-2.5 start-2.5 flex items-center gap-1 rounded-full bg-white/90 py-0.5 pe-2.5 ps-1 text-[12px] font-bold text-[#1d1d1f]">
                      <Emoji3D src={SPECIES_EMOJI[a.species]} size={18} /> {t.adopt.age(a.ageMonths)}
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
