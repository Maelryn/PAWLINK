"use client";

import { useDemoText } from "@/lib/i18n/content";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { TopNav } from "@/components/layout/TopNav";

import { useI18n } from "@/lib/i18n";
import { store, useStore } from "@/lib/store";
import { useSession } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Emoji3D } from "@/components/ui/primitives";
import { LIVESTOCK } from "@/lib/species";
import type { Species } from "@/lib/types";
import type { Dict } from "@/lib/i18n/en";
import { cn } from "@/lib/utils";
import { Heart, MapPin, PawPrint } from "lucide-react";
import { Pager } from "@/components/ui/Pager";
import { useNearMe } from "@/lib/useNearMe";
import { distanceKm } from "@/lib/utils";

const PAGE = 12;

type Cat = "all" | "saved" | "dog" | "cat" | "livestock" | "other";
const CATS: { id: Cat; label: (t: Dict) => string; pet?: { src: string; bg: string } }[] = [
  { id: "all", label: (t) => t.adopt.filterAll },
  { id: "saved", label: (t) => t.adopt.savedTab, pet: { src: "/3d/heart.png", bg: "#ffe0e6" } },
  { id: "dog", label: (t) => t.common.species.dog, pet: { src: "/3d/dog.png", bg: "#cfe5ff" } },
  { id: "cat", label: (t) => t.common.species.cat, pet: { src: "/3d/cat.png", bg: "#ffd8e4" } },
  { id: "livestock", label: (t) => t.common.livestock, pet: { src: "/3d/sheep.png", bg: "#cdeedd" } },
  { id: "other", label: (t) => t.common.species.other, pet: { src: "/3d/rabbit.png", bg: "#e3dcff" } },
];
const matches = (c: Cat, s: Species) =>
  c === "all" || c === "saved" || (c === "livestock" ? LIVESTOCK.includes(s) : c === "other" ? !LIVESTOCK.includes(s) && s !== "dog" && s !== "cat" : s === c);

export default function AdoptPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Cat>("all");
  const user = useSession();
  const dt = useDemoText();
  const router = useRouter();
  const allFavs = useStore((s) => s.favorites);
  const favs = (user && allFavs[user.id]) || [];
  const near = useNearMe();
  const [page, setPage] = useState(1);
  // closest first when we know where you are (device, or the city on your profile), newest first otherwise
  const list = useStore((s) => s.adoptions)
    .filter((a) => a.status === "approved" && matches(filter, a.species) && (filter !== "saved" || favs.includes(a.id)))
    .map((a) => ({ a, d: near.origin ? distanceKm(near.origin, a.location) : undefined }))
    .sort((x, y) => (x.d !== undefined && y.d !== undefined ? x.d - y.d : +new Date(y.a.createdAt) - +new Date(x.a.createdAt)));
  const pages = Math.ceil(list.length / PAGE);
  const cur = Math.min(page, Math.max(1, pages));
  const shown = list.slice((cur - 1) * PAGE, cur * PAGE);
  const toggleFav = (id: string) => {
    if (!user) {
      toast(t.adopt.signInToSave);
      router.push("/login?next=/adopt");
      return;
    }
    const on = store.toggleFavorite(user.id, id);
    if (navigator.vibrate) navigator.vibrate(on ? 12 : 6);
    toast.success(on ? t.adopt.saved : t.adopt.removed);
  };

  return (
    <div className="min-h-[100svh] pb-32">
      <TopNav />
      <div className="mx-auto max-w-[1180px] px-4 pt-[76px] sm:pt-24">
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 text-[30px] font-black leading-tight sm:text-[38px]">{t.adopt.title}</h1>
          <button
            type="button"
            onClick={async () => {
              setPage(1);
              if (near.origin) return near.clear();
              if (!(await near.locate())) toast(t.svc.locFail);
            }}
            aria-pressed={!!near.origin}
            className={cn("flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold transition-[background,transform] active:scale-95", near.origin ? "bg-accent text-white" : "bg-surface-2")}
          >
            <MapPin className={cn("h-4 w-4", near.origin ? "text-white" : "text-accent", near.locating && "animate-pulse")} />
            {near.locating ? t.svc.locating : t.svc.nearMe}
          </button>
        </div>
        <p className="mt-1 max-w-[560px] text-[15px] text-label-2">{t.adopt.subtitle}</p>

        {/* categories with real pet photos (same pattern as Services) */}
        <div className="scroll-fade -mx-4 mt-3 flex gap-4 overflow-x-auto px-4 py-2 no-scrollbar">
          {CATS.map((c) => {
            const on = filter === c.id;
            return (
              <button key={c.id} type="button" onClick={() => { setFilter(c.id); setPage(1); }} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5">
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

        {list.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <Emoji3D src={filter === "saved" ? "/3d/heart.png" : "/3d/paw.png"} size={64} />
            <p className="max-w-[280px] text-[15px] text-label-2">{filter === "saved" ? t.adopt.noSaved : t.adopt.empty}</p>
          </div>
        )}

        <motion.div layout className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {shown.map(({ a, d }, i) => (
              <motion.div key={a.id} layout initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", stiffness: 280, damping: 26, delay: Math.min(i * 0.04, 0.3) }}>
                <Link href={`/adopt/${a.id}`} className="group block active:scale-[0.98]">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[24px] bg-surface-2 shadow-[var(--card-shadow)]">
                    <Image src={a.photos[0]} alt={a.name} fill unoptimized={a.photos[0].startsWith("data:")} sizes="(min-width:1024px) 280px, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.8 }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFav(a.id);
                      }}
                      aria-label={favs.includes(a.id) ? t.adopt.saved : t.adopt.save}
                      aria-pressed={favs.includes(a.id)}
                      className="glass absolute end-2 top-2 flex h-10 w-10 items-center justify-center rounded-full"
                    >
                      <Heart className={cn("h-[19px] w-[19px] text-[#ff2d55] transition-transform", favs.includes(a.id) && "scale-110 fill-[#ff2d55]")} />
                    </motion.button>
                    <span className="absolute bottom-2.5 start-2.5 flex items-center gap-1 rounded-full bg-white/90 py-0.5 pe-2.5 ps-1 text-[12px] font-bold text-[#1d1d1f]">
                      {t.adopt.age(a.ageMonths)}
                    </span>
                  </div>
                  <div className="px-1 pt-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-display text-[18px] font-extrabold">{a.name}</span>
                      <span className="shrink-0 text-[13px] font-semibold text-label-2">{a.sex === "male" ? "♂" : "♀"}</span>
                    </div>
                    <div className="truncate text-[12.5px] text-label-2">{d !== undefined ? `${t.common.km(d)} · ` : ""}{dt(a.breed)} · {a.location.address}</div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
        <Pager id="adopt" page={cur} pages={pages} onChange={setPage} />
      </div>
    </div>
  );
}
