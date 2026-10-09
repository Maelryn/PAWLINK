"use client";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { AnimatePresence, motion } from "motion/react";
import { Check, EyeOff, LayoutGrid, ListChecks, Map as MapIcon, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { TopNav } from "@/components/layout/TopNav";
import { MapView } from "@/components/map";
import { CountUp } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Avatar, CasePhoto, Emoji3D, TimeAgo, TriageBadge } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import { EMERGENCY_ZONES, USERS } from "@/lib/mock/data";
import { SPECIES_EMOJI, TRIAGE_COLOR } from "@/lib/species";
import { store, useStore } from "@/lib/store";
import { TrustBadge } from "@/components/cases/Trust";
import { AdoptionQueue, ServiceQueue } from "@/components/adopt/AdoptionPanels";
import type { Triage } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "overview" | "cases" | "zones" | "users";

export default function Page() {
  return (
    <RequireAuth area="admin">
      <AdminPage />
    </RequireAuth>
  );
}

function AdminPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("overview");
  const tabs: { id: Tab; label: string; icon: typeof LayoutGrid }[] = [
    { id: "overview", label: t.admin.overview, icon: LayoutGrid },
    { id: "cases", label: t.admin.cases, icon: ListChecks },
    { id: "zones", label: t.admin.zones, icon: MapIcon },
    { id: "users", label: t.admin.users, icon: Users },
  ];

  return (
    <div className="min-h-[100svh] pb-32">
      <TopNav />
      <div className="mx-auto max-w-[1280px] px-4 pt-[76px] sm:pt-24">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
          {/* macOS-style sidebar */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="mb-4 flex items-center gap-2 px-2">
              <Emoji3D src="/3d/shield.png" size={30} />
              <h1 className="text-[22px] font-bold tracking-[-0.03em]">{t.admin.title}</h1>
            </div>
            <nav className="flex gap-1 overflow-x-auto no-scrollbar lg:flex-col">
              {tabs.map((x) => {
                const Icon = x.icon;
                const active = tab === x.id;
                return (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => setTab(x.id)}
                    className={cn("relative flex shrink-0 items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-[14.5px] font-medium transition-colors", active ? "text-white" : "text-label hover:bg-black/5 dark:hover:bg-white/10")}
                  >
                    {active && <motion.span layoutId="admin-tab" className="absolute inset-0 rounded-[12px] bg-accent" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
                    <Icon className="relative h-[18px] w-[18px]" />
                    <span className="relative">{x.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                {tab === "overview" && <Overview />}
                {tab === "cases" && (
                  <>
                    <ServiceQueue />
                    <AdoptionQueue />
                    <Moderation />
                  </>
                )}
                {tab === "zones" && <Zones />}
                {tab === "users" && <UsersTable />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}

function Kpi({ e, n, label, suffix, delay }: { e: string; n: number; label: string; suffix?: string; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="card rounded-[24px] p-5">
      <Emoji3D src={e} size={34} />
      <div className="mt-3 text-[32px] font-bold leading-none tracking-[-0.03em]">
        <CountUp to={n} />
        {suffix && <span className="text-[18px] text-label-2">{suffix}</span>}
      </div>
      <div className="mt-1 text-[13px] text-label-2">{label}</div>
    </motion.div>
  );
}

function Overview() {
  const { t, locale } = useI18n();
  const cases = useStore((s) => s.cases);
  const byTriage = (["urgent", "monitoring", "stable"] as Triage[]).map((tr) => ({ tr, n: cases.filter((c) => c.triage === tr).length }));
  const total = cases.length;
  const urgentOpen = cases.filter((c) => c.triage === "urgent" && c.status !== "resolved").length;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 25 + i));
    return { label: d.toLocaleDateString(locale === "ar" ? "ar-DZ" : locale === "en" ? "en-GB" : "fr-FR", { weekday: "short", timeZone: "UTC" }), v: [9, 12, 8, 15, 11, 31, 46][i] };
  });
  const wilayas = [
    { name: "Tizi Ouzou", v: 46 },
    { name: "Alger", v: 31 },
    { name: "Béjaïa", v: 18 },
    { name: "Oran", v: 14 },
    { name: "Djelfa", v: 9 },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi e="/3d/fire.png" n={EMERGENCY_ZONES.length} label={t.admin.activeZones} delay={0} />
        <Kpi e="/3d/paw.png" n={total} label={t.admin.totalCases} delay={0.05} />
        <Kpi e="/3d/warning.png" n={urgentOpen} label={t.admin.urgentOpen} delay={0.1} />
        <Kpi e="/3d/ambulance.png" n={14} suffix=" min" label={t.admin.avgResponse} delay={0.15} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <section className="card rounded-[28px] p-6">
          <h2 className="text-[17px] font-semibold">{t.admin.last7}</h2>
          <BarChart data={days} />
        </section>
        <section className="card rounded-[28px] p-6">
          <h2 className="text-[17px] font-semibold">{t.admin.byTriage}</h2>
          <div className="mt-5 flex h-4 gap-[2px] overflow-hidden rounded-full">
            {byTriage.map((b, i) => (
              <motion.div
                key={b.tr}
                initial={{ width: 0 }}
                animate={{ width: `${(b.n / total) * 100}%` }}
                transition={{ duration: 0.9, delay: 0.1 * i, ease: [0.16, 1, 0.3, 1] }}
                style={{ background: TRIAGE_COLOR[b.tr] }}
                title={`${t.common.triage[b.tr]}: ${b.n}`}
              />
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {byTriage.map((b) => (
              <div key={b.tr} className="flex items-center gap-3 text-[14px]">
                <TriageBadge triage={b.tr} size="sm" />
                <span className="flex-1" />
                <span className="font-semibold tabular-nums">{b.n}</span>
                <span className="w-12 text-end tabular-nums text-label-2">{Math.round((b.n / total) * 100)}%</span>
              </div>
            ))}
          </div>
          <h2 className="mt-7 text-[17px] font-semibold">{t.admin.byWilaya}</h2>
          <div className="mt-3 space-y-2.5">
            {wilayas.map((w, i) => (
              <div key={w.name} className="group flex items-center gap-3 text-[13.5px]" title={`${w.name}: ${w.v}`}>
                <span className="w-24 truncate">{w.name}</span>
                <span className="relative h-2.5 flex-1">
                  <motion.span
                    className="absolute inset-y-0 start-0 rounded-e-[4px] bg-accent transition-opacity group-hover:opacity-80"
                    initial={{ width: 0 }}
                    animate={{ width: `${(w.v / wilayas[0].v) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.08 * i, ease: [0.16, 1, 0.3, 1] }}
                  />
                </span>
                <span className="w-8 text-end font-semibold tabular-nums">{w.v}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Single-series column chart with a hover tooltip. */
function BarChart({ data }: { data: { label: string; v: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.v));
  const ticks = [0, Math.round(max / 2), max];
  return (
    <div className="relative mt-6 h-[220px]">
      <div className="absolute inset-x-0 bottom-6 top-0">
        {ticks.map((tk) => (
          <div key={tk} className="absolute inset-x-0 border-t border-separator" style={{ bottom: `${(tk / max) * 100}%` }}>
            <span className="absolute -top-2.5 end-0 bg-surface ps-1 text-[11px] tabular-nums text-label-2">{tk}</span>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 top-0 flex items-end gap-3 pe-8">
        {data.map((d, i) => (
          <div key={i} className="relative flex h-full flex-1 flex-col items-center justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div className="relative flex w-full flex-1 items-end justify-center pb-6">
              <motion.div
                className="w-full max-w-[34px] rounded-t-[4px]"
                style={{ background: i >= 5 ? "var(--urgent)" : "var(--accent)", opacity: hover === null || hover === i ? 1 : 0.45 }}
                initial={{ height: 0 }}
                animate={{ height: `${(d.v / max) * 100}%` }}
                transition={{ duration: 0.9, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
              />
              <AnimatePresence>
                {hover === i && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="glass-strong absolute z-10 rounded-[10px] px-2.5 py-1.5 text-[12px] font-semibold"
                    style={{ bottom: `calc(${(d.v / max) * 100}% + 32px)` }}
                  >
                    {d.v}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className="absolute bottom-0 text-[11.5px] capitalize text-label-2">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Moderation() {
  const { t } = useI18n();
  const cases = useStore((s) => s.cases);
  const queue = [...cases].sort((a, b) => (a.moderation === "pending" ? -1 : 0) - (b.moderation === "pending" ? -1 : 0) || (a.trust?.score ?? 1) - (b.trust?.score ?? 1));
  return (
    <section className="card overflow-hidden rounded-[28px]">
      <div className="flex items-center justify-between p-5">
        <h2 className="text-[19px] font-bold">{t.admin.moderation}</h2>
        <span className="rounded-full bg-monitor-soft px-3 py-1 text-[13px] font-semibold text-monitor">{cases.filter((c) => c.moderation === "pending").length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[14px]">
          <thead>
            <tr className="border-y border-separator text-start text-[12px] uppercase tracking-wide text-label-2">
              <th className="px-5 py-2.5 text-start font-semibold">{t.admin.animal}</th>
              <th className="px-3 py-2.5 text-start font-semibold">{t.ai.triageLabel}</th>
              <th className="px-3 py-2.5 text-start font-semibold">{t.trust.title}</th>
              <th className="px-3 py-2.5 text-start font-semibold">{t.admin.reported}</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {queue.slice(0, 16).map((c) => (
              <tr key={c.id} className={cn("border-b border-separator transition-opacity", c.moderation === "hidden" && "opacity-35", c.moderation === "pending" && "bg-monitor-soft/40")}>
                <td className="px-5 py-3">
                  <Link href={`/cases/${c.id}`} className="flex items-center gap-3">
                    <CasePhoto photo={c.photos[0]} emoji={SPECIES_EMOJI[c.species]} emojiSize={24} sizes="44px" className="h-11 w-11 shrink-0 rounded-[12px]" />
                    <div className="min-w-0">
                      <div className="max-w-[260px] truncate font-semibold">{c.title}</div>
                      <div className="text-[12.5px] text-label-2">{c.location.address}</div>
                    </div>
                  </Link>
                </td>
                <td className="px-3">
                  <TriageBadge triage={c.triage} size="sm" />
                </td>
                <td className="px-3">{c.trust && <TrustBadge level={c.trust.level} />}</td>
                <td className="px-3 text-label-2">
                  <TimeAgo iso={c.createdAt} />
                </td>
                <td className="px-5">
                  <div className="flex justify-end gap-1.5">
                    {c.moderation !== "pending" ? (
                      <span className={cn("rounded-full px-3 py-1.5 text-[12.5px] font-semibold", c.moderation === "hidden" ? "bg-surface-2 text-label-2" : "bg-stable-soft text-stable")}>
                        {c.moderation === "hidden" ? t.admin.reject : t.admin.approve} ✓
                      </span>
                    ) : (
                      <>
                        <button type="button" onClick={() => store.moderate(c.id, "approved")} className="flex h-8 w-8 items-center justify-center rounded-full bg-stable-soft text-stable" title={t.admin.approve}>
                          <Check className="h-4 w-4" strokeWidth={2.6} />
                        </button>
                        <button type="button" onClick={() => store.moderate(c.id, "hidden")} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-label-2" title={t.admin.reject}>
                          <EyeOff className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Zones() {
  const { t } = useI18n();
  const cases = useStore((s) => s.cases);
  const z = EMERGENCY_ZONES[0];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[22px] font-bold tracking-[-0.02em]">{t.admin.zones}</h2>
        <Button size="sm" variant="danger" onClick={() => toast(t.admin.newZone, { description: t.common.demo, icon: <Emoji3D src="/3d/fire.png" size={20} /> })}>
          <Plus className="h-4 w-4" /> {t.admin.newZone}
        </Button>
      </div>
      <section className="card overflow-hidden rounded-[28px]">
        <div className="h-[380px]">
          <MapView cases={cases.filter((c) => c.emergencyZoneId === z.id)} zone={z} interactive={false} initialView={{ longitude: z.center.lng, latitude: z.center.lat, zoom: 10.6, pitch: 40 }} />
        </div>
        <div className="flex flex-wrap items-center gap-4 p-5">
          <Emoji3D src="/3d/fire.png" size={40} />
          <div className="flex-1">
            <div className="text-[17px] font-semibold">{z.name}</div>
            <div className="text-[13px] text-label-2">{z.region}</div>
          </div>
          {[
            { n: z.stats.cases, l: t.map.zoneStats.cases },
            { n: z.stats.urgent, l: t.map.zoneStats.urgent },
            { n: z.stats.helpers, l: t.map.zoneStats.helpers },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="text-[22px] font-bold tabular-nums">{s.n}</div>
              <div className="text-[11.5px] text-label-2">{s.l}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function UsersTable() {
  const { t } = useI18n();
  const color: Record<string, string> = { reporter: "var(--label-2)", volunteer: "var(--stable)", vet: "var(--accent)", admin: "var(--accent-2)" };
  return (
    <section className="card overflow-hidden rounded-[28px]">
      <h2 className="p-5 text-[19px] font-bold">{t.admin.users}</h2>
      <div className="divide-y divide-separator border-t border-separator">
        {USERS.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-5 py-3">
            <Avatar name={u.name} size={38} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold">{u.name}</div>
              <div className="text-[12.5px] text-label-2">{u.helpTypes?.map((h) => t.common.help[h]).join(" · ") || "—"}</div>
            </div>
            {u.rating && <span className="text-[13px] font-semibold tabular-nums text-label-2">★ {u.rating}</span>}
            <span className="rounded-full px-3 py-1 text-[12.5px] font-semibold" style={{ color: color[u.role], background: `color-mix(in srgb, ${color[u.role]} 14%, transparent)` }}>
              {t.dashboard.roles[u.role]}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
