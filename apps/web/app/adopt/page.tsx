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
            <h1 className="mt-1 text-[44px] font-bold leading-[1.02] tracking-[-0.045em] sm:text-[64px]">{t.adopt.title}</h1>
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

        <motion.div layout className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {list.map((a, i) => (
              <motion.div
                key={a.id}
                layout
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 260, damping: 26, delay: i * 0.05 }}
              >
                <Link href={`/adopt/${a.id}`} className="group block">
                  <motion.div
                    whileHover={{ y: -6 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 300, damping: 22 }}
                    className="relative h-[440px] overflow-hidden rounded-[36px] shadow-[var(--card-shadow)] transition-shadow duration-500 group-hover:shadow-[var(--card-shadow-hover)]"
                  >
                    <Image src={a.photos[0]} alt={a.name} fill unoptimized={a.photos[0].startsWith("data:")} sizes="(min-width:1024px) 380px, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
                    <div className="absolute start-5 top-5 text-[12px] font-bold uppercase tracking-wider text-white/85">{a.shelter.name}</div>
                    <span className="glass absolute end-4 top-4 flex h-11 w-11 items-center justify-center rounded-full">
                      <Emoji3D src={SPECIES_EMOJI[a.species]} size={26} />
                    </span>
                    <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                      <div className="text-[34px] font-bold tracking-[-0.035em]">{a.name}</div>
                      <div className="text-[15px] text-white/80">
                        {a.breed} · {t.adopt.age(a.ageMonths)} · {t.adopt.sex[a.sex]}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {a.behavior.slice(0, 2).map((b) => (
                          <span key={b} className="rounded-full bg-white/20 px-3 py-1 text-[12.5px] font-medium backdrop-blur-md">
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
