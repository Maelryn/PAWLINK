"use client";

import { motion } from "motion/react";
import { Mascot } from "@/components/brand/Mascot";
import { ArrowLeft, Share2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { AICard } from "@/components/cases/AICard";
import { HelpPicker } from "@/components/cases/CaseBits";
import { TopNav } from "@/components/layout/TopNav";
import { MapView } from "@/components/map";
import { Reveal } from "@/components/motion";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar, CasePhoto, Emoji3D, TimeAgo, TriageBadge } from "@/components/ui/primitives";
import { useCaseAI } from "@/lib/ai/useCaseAI";
import { useI18n } from "@/lib/i18n";
import { EMERGENCY_ZONES } from "@/lib/mock/data";
import { HELP_EMOJI, SPECIES_EMOJI } from "@/lib/species";
import { useStore } from "@/lib/store";
import { useSession } from "@/lib/auth";
import { gmaps, gmapsDirections } from "@/lib/trust";
import { TrustBadge, TrustPanel } from "@/components/cases/Trust";

export default function CasePage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const c = useStore((s) => s.cases).find((x) => x.id === id);
  const ai = useCaseAI(c);
  const user = useSession();

  if (!c)
    return (
      <>
        <TopNav />
        <div className="flex min-h-[80svh] flex-col items-center justify-center gap-4 text-label-2">
          <Mascot size={90} />
          {t.case.notFound}
          <ButtonLink href="/map">{t.nav.openApp}</ButtonLink>
        </div>
      </>
    );

  const zone = c.emergencyZoneId ? EMERGENCY_ZONES.find((z) => z.id === c.emergencyZoneId) : null;
  const timeline = [
    { label: t.case.created, at: c.createdAt, icon: "/3d/camera.png" },
    { label: t.case.aiDone, at: c.createdAt, icon: "/3d/sparkles.png" },
    ...c.helpers.map((h) => ({ label: `${t.case.helperJoined(h.user.name)} · ${t.common.help[h.helpType]}`, at: c.updatedAt, icon: HELP_EMOJI[h.helpType] })),
  ];

  return (
    <div className="min-h-[100svh] pb-32">
      <TopNav />
      <div className="mx-auto max-w-[1180px] px-4 pt-24 sm:pt-28">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/map" className="glass flex h-10 items-center gap-1.5 rounded-full pe-4 ps-3 text-[14px] font-semibold">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t.nav.map}
          </Link>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              toast.success(t.common.share, { description: window.location.href });
            }}
            className="glass flex h-10 w-10 items-center justify-center rounded-full"
            aria-label={t.common.share}
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>

        {/* Photo stays clean; details live in a sheet under it (iOS detail-view pattern) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 24 }}
          className="overflow-hidden rounded-[36px] bg-surface shadow-[var(--card-shadow)]"
        >
          <div className="relative">
            <CasePhoto photo={c.photos[0]} emoji={SPECIES_EMOJI[c.species]} emojiSize={200} sizes="1200px" priority className="h-[46svh] max-h-[520px] min-h-[280px] w-full" />
            <span className="glass absolute end-4 top-4 flex h-11 items-center gap-1.5 rounded-full pe-4 ps-2 text-[14px] font-semibold">
              <Emoji3D src={SPECIES_EMOJI[c.species]} size={28} /> {t.common.species[c.species]}
              {(c.count ?? 1) > 1 && ` ×${c.count}`}
            </span>
          </div>
          <div className="relative -mt-7 rounded-t-[30px] bg-surface p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <TriageBadge triage={c.triage} size="lg" />
              <span className="rounded-full bg-surface-2 px-3 py-1.5 text-[13px] font-semibold text-label-2">{t.common.status[c.status]}</span>
              {zone && <span className="rounded-full bg-urgent-soft px-3 py-1.5 text-[13px] font-semibold text-urgent">🔥 {t.case.inZone}</span>}
              {c.trust && <TrustBadge level={c.trust.level} />}
            </div>
            <h1 className="mt-3 text-[28px] font-extrabold leading-[1.1] sm:text-[40px]">{c.title}</h1>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <a href={gmaps(c.location)} target="_blank" rel="noopener noreferrer" className="col-span-2 flex items-center gap-3 rounded-[18px] bg-surface-2 p-3 transition-colors hover:bg-surface-3 sm:col-span-1">
                <Emoji3D src="/3d/pin.png" size={30} />
                <span className="min-w-0">
                  <span className="block text-[11.5px] font-semibold uppercase tracking-wide text-label-2">{t.case.location}</span>
                  <span className="block truncate text-[14.5px] font-semibold text-accent">{c.location.address}</span>
                </span>
              </a>
              <div className="flex items-center gap-3 rounded-[18px] bg-surface-2 p-3">
                <Emoji3D src="/3d/bell.png" size={30} />
                <span className="min-w-0">
                  <span className="block text-[11.5px] font-semibold uppercase tracking-wide text-label-2">{t.case.created}</span>
                  <span className="block text-[14.5px] font-semibold"><TimeAgo iso={c.createdAt} /></span>
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-[18px] bg-surface-2 p-3">
                <Emoji3D src="/3d/hearthands.png" size={30} />
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-semibold">{t.common.helpers(c.helpers.length)}</span>
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <Reveal>
              <section className="card rounded-[32px] p-6">
                <h2 className="text-[20px] font-bold tracking-[-0.02em]">{t.case.description}</h2>
                <p className="mt-2 text-[16px] leading-relaxed">{c.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {c.conditionTags.map((tag) => (
                    <span key={tag} className="rounded-full bg-surface-2 px-3 py-1.5 text-[13px] font-medium">
                      {t.common.tags[tag] ?? tag}
                    </span>
                  ))}
                </div>
                <div className="mt-5 flex items-center gap-3 border-t border-separator pt-4">
                  <Avatar name={c.reporter.name} size={40} />
                  <div className="text-[14px]">
                    <div className="text-label-2">{t.common.reportedBy}</div>
                    <div className="font-semibold">{c.reporter.name}</div>
                  </div>
                </div>
              </section>
            </Reveal>

            {ai && (
              <Reveal delay={0.05}>
                <AICard ai={ai} />
              </Reveal>
            )}

            <Reveal delay={0.08}>
              <TrustPanel c={c} canAct={!!user && user.id !== c.reporter.id} />
            </Reveal>

            <Reveal delay={0.1}>
              <section className="card rounded-[32px] p-6">
                <h2 className="text-[20px] font-bold tracking-[-0.02em]">{t.case.timeline}</h2>
                <ol className="relative mt-4 space-y-5 ps-2">
                  <span className="absolute bottom-3 start-[25px] top-3 w-px bg-separator" />
                  {timeline.map((e, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -12 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08 }}
                      className="relative flex items-center gap-4"
                    >
                      <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 ring-4 ring-surface">
                        <Emoji3D src={e.icon} size={22} />
                      </span>
                      <div className="text-[14.5px]">
                        <div className="font-semibold">{e.label}</div>
                        <div className="text-[12.5px] text-label-2">
                          <TimeAgo iso={e.at} />
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </ol>
              </section>
            </Reveal>
          </div>

          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Reveal>
              <section className="card overflow-hidden rounded-[32px]">
                <div className="h-56">
                  <MapView
                    cases={[c]}
                    zone={zone ?? null}
                    interactive={false}
                    initialView={{ longitude: c.location.lng, latitude: c.location.lat, zoom: 12.5, pitch: 45, bearing: -10 }}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold uppercase tracking-wide text-label-2">{t.case.location}</div>
                    <a href={gmaps(c.location)} target="_blank" rel="noopener noreferrer" className="block truncate text-[15px] font-semibold text-accent hover:underline">
                      {c.location.address}
                    </a>
                    <div className="font-mono text-[11.5px] text-label-2" dir="ltr">
                      {c.location.lat.toFixed(5)}, {c.location.lng.toFixed(5)}
                    </div>
                  </div>
                  <ButtonLink href={gmapsDirections(c.location)} size="sm">
                    {t.maps.directions}
                  </ButtonLink>
                </div>
              </section>
            </Reveal>
            <Reveal delay={0.08}>
              <section className="card rounded-[32px] p-5">
                <HelpPicker c={c} />
                {c.helpers.length > 0 && (
                  <div className="mt-5 border-t border-separator pt-4">
                    <div className="text-[13px] font-semibold text-label-2">{t.common.helpers(c.helpers.length)}</div>
                    <div className="mt-2 space-y-2">
                      {c.helpers.map((h) => (
                        <div key={h.user.id} className="flex items-center gap-3">
                          <Avatar name={h.user.name} size={34} />
                          <div className="flex-1 text-[14px] font-semibold">{h.user.name}</div>
                          <span className="flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pe-3 ps-1.5 text-[12.5px] font-medium">
                            <Emoji3D src={HELP_EMOJI[h.helpType]} size={18} />
                            {t.common.help[h.helpType]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  );
}
