"use client";

import { ProfileLink } from "@/components/account/ProfileLink";

import { useCaseText } from "@/lib/i18n/content";

import { moderateCase } from "@/lib/cases";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { AnimatePresence, motion } from "motion/react";
import { Check, EyeOff, LayoutGrid, ListChecks, Map as MapIcon, Plus, Users, Phone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { TopNav } from "@/components/layout/TopNav";
import { MapView } from "@/components/map";
import { CountUp } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Avatar, CasePhoto, Emoji3D, TimeAgo, TriageBadge } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import { circlePolygon, suggestZones, zoneStats, ZONE_PLACES } from "@/lib/zones";
import { SPECIES_EMOJI, TRIAGE_COLOR } from "@/lib/species";
import { store, useStore } from "@/lib/store";
import { apiOn } from "@/lib/api/client";
import { admin as adminApi, zones as zonesApi } from "@/lib/api/endpoints";
import { TrustBadge } from "@/components/cases/Trust";
import { AdoptionQueue, EditQueue, ServiceQueue } from "@/components/adopt/AdoptionPanels";
import type { EmergencyZone, Triage } from "@/lib/types";
import { cn, minutesSince } from "@/lib/utils";

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
            <nav className="scroll-fade lg-no-fade flex gap-1 overflow-x-auto no-scrollbar lg:flex-col">
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
                    <EditQueue />
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

function Kpi({ e, n, label, suffix, delay }: { e: string; n: number | null; label: string; suffix?: string; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="card rounded-[24px] p-5">
      <Emoji3D src={e} size={34} />
      <div className="mt-3 text-[32px] font-bold leading-none tracking-[-0.03em]">
        {n === null ? "—" : <CountUp to={n} />}
        {suffix && n !== null && <span className="text-[18px] text-label-2">{suffix}</span>}
      </div>
      <div className="mt-1 text-[13px] text-label-2">{label}</div>
    </motion.div>
  );
}

function Overview() {
  const { t, locale } = useI18n();
  const cases = useStore((s) => s.cases);
  const zones = useStore((s) => s.zones);
  const byTriage = (["urgent", "monitoring", "stable"] as Triage[]).map((tr) => ({ tr, n: cases.filter((c) => c.triage === tr).length }));
  const total = cases.length;
  const urgentOpen = cases.filter((c) => c.triage === "urgent" && c.status !== "resolved").length;

  // Everything below is computed from the real cases (no made-up numbers)
  const dayKey = (d: Date) => d.toLocaleDateString("en-CA");
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = dayKey(d);
    return {
      label: d.toLocaleDateString(locale === "ar" ? "ar-DZ" : locale === "en" ? "en-GB" : "fr-FR", { weekday: "short" }),
      v: cases.filter((c) => dayKey(new Date(c.createdAt)) === key).length,
    };
  });
  const byCity = new Map<string, number>();
  for (const c of cases) {
    const city = (c.location.address ?? "").split(",").pop()?.trim();
    if (city) byCity.set(city, (byCity.get(city) ?? 0) + 1);
  }
  const wilayas = [...byCity].map(([name, v]) => ({ name, v })).sort((a, b) => b.v - a.v).slice(0, 5);
  // time from the report to the first change (someone helping / resolving), for cases that moved
  const moved = cases.filter((c) => c.status !== "open" && c.updatedAt && c.updatedAt !== c.createdAt);
  const avgResponse = moved.length ? Math.round(moved.reduce((sum, c) => sum + (+new Date(c.updatedAt) - +new Date(c.createdAt)) / 60000, 0) / moved.length) : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi e="/3d/fire.png" n={zones.filter((z) => z.active).length} label={t.admin.activeZones} delay={0} />
        <Kpi e="/3d/paw.png" n={total} label={t.admin.totalCases} delay={0.05} />
        <Kpi e="/3d/warning.png" n={urgentOpen} label={t.admin.urgentOpen} delay={0.1} />
        <Kpi e="/3d/ambulance.png" n={avgResponse} suffix=" min" label={t.admin.avgResponse} delay={0.15} />
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
                animate={{ width: `${total ? (b.n / total) * 100 : 0}%` }}
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
                <span className="w-12 text-end tabular-nums text-label-2">{total ? Math.round((b.n / total) * 100) : 0}%</span>
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
                    animate={{ width: `${(w.v / (wilayas[0]?.v || 1)) * 100}%` }}
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
  const ct = useCaseText();
  const { t } = useI18n();
  const cases = useStore((s) => s.cases);
  const users = useStore((s) => s.users);
  const phoneOf = (id: string) => users.find((u) => u.id === id)?.phone;
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
                      <div className="max-w-[260px] truncate font-semibold">{ct(c).title}</div>
                      <div className="text-[12.5px] text-label-2">{c.location.address}</div>
                    </div>
                  </Link>
                  <ProfileLink id={c.reporter.id} className="me-2 mt-1 inline-block text-[12.5px] font-semibold">
                    {c.reporter.name}
                  </ProfileLink>
                  {phoneOf(c.reporter.id) && (
                    <a href={`tel:${phoneOf(c.reporter.id)!.replace(/\s/g, "")}`} className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent" dir="ltr">
                      <Phone className="h-3.5 w-3.5" /> {phoneOf(c.reporter.id)}
                    </a>
                  )}
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
                        <button type="button" onClick={() => moderateCase(c, "approved")} className="flex h-10 w-10 items-center justify-center rounded-full bg-stable-soft text-stable" title={t.admin.approve}>
                          <Check className="h-4 w-4" strokeWidth={2.6} />
                        </button>
                        <button type="button" onClick={() => moderateCase(c, "hidden")} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-label-2" title={t.admin.reject}>
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
  const { t, locale } = useI18n();
  const cases = useStore((s) => s.cases);
  const zones = useStore((s) => s.zones);
  const active = zones.filter((z) => z.active);
  const past = zones.filter((z) => !z.active);
  const suggestions = suggestZones(cases, zones);
  const [form, setForm] = useState(false);
  const [f, setF] = useState({ type: "wildfire" as EmergencyZone["type"], name: "", place: ZONE_PLACES[1].name, radius: 8 });
  const fmt = (iso: string) => new Date(iso).toLocaleString(locale === "ar" ? "ar-DZ" : locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const declare = (input: { type: EmergencyZone["type"]; name: string; region: string; center: { lat: number; lng: number }; radiusKm: number }) => {
    if (apiOn("services")) {
      void zonesApi.create({ name: input.name, region: input.region, type: input.type, polygon: circlePolygon(input.center, input.radiusKm), radiusKm: input.radiusKm, active: true, startedAt: new Date().toISOString() }).catch(() => {});
    }
    store.declareZone(input);
    toast.success(t.admin.declared, { icon: <Emoji3D src="/3d/fire.png" size={20} /> });
  };
  const field = "h-11 w-full rounded-[14px] bg-surface-2 px-3.5 text-[15px] outline-none ring-accent/40 focus:ring-2";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[22px] font-bold tracking-[-0.02em]">{t.admin.zones}</h2>
        <Button size="sm" variant="danger" onClick={() => setForm((v) => !v)}>
          <Plus className="h-4 w-4" /> {t.admin.newZone}
        </Button>
      </div>

      {/* declare by hand */}
      <AnimatePresence initial={false}>
        {form && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="card overflow-hidden rounded-[28px]"
            onSubmit={(e) => {
              e.preventDefault();
              const p = ZONE_PLACES.find((x) => x.name === f.place)!;
              declare({ type: f.type, name: f.name.trim() || `${t.admin.zoneTypes[f.type]} — ${p.name}`, region: p.name, center: { lat: p.lat, lng: p.lng }, radiusKm: f.radius });
              setForm(false);
              setF((x) => ({ ...x, name: "" }));
            }}
          >
            <div className="space-y-3 p-5">
              <div className="flex flex-wrap gap-1.5">
                {(["wildfire", "flood", "earthquake", "other"] as const).map((ty) => (
                  <button key={ty} type="button" onClick={() => setF({ ...f, type: ty })} className={cn("h-10 rounded-full px-4 text-[14px] font-semibold transition-colors", f.type === ty ? "bg-urgent text-white" : "bg-surface-2")}>
                    {t.admin.zoneTypes[ty]}
                  </button>
                ))}
              </div>
              <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t.admin.zoneName} className={field} />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block ps-1 text-[13px] font-semibold text-label-2">{t.admin.zonePlace}</span>
                  <select value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} className={field}>
                    {ZONE_PLACES.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block ps-1 text-[13px] font-semibold text-label-2">{t.admin.zoneRadius(f.radius)}</span>
                  <input type="range" min={2} max={40} value={f.radius} onChange={(e) => setF({ ...f, radius: Number(e.target.value) })} className="h-11 w-full accent-[var(--urgent)]" />
                </label>
              </div>
              <Button type="submit" variant="danger" className="w-full">{t.admin.declare}</Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* PawLink noticed a cluster: a human decides */}
      {suggestions.map((sg) => (
        <section key={sg.caseIds.join()} className="flex flex-wrap items-center gap-4 rounded-[28px] bg-monitor-soft p-5">
          <Emoji3D src="/3d/warning.png" size={40} />
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-bold">{t.admin.suggestTitle}</div>
            <p className="text-[14px]">{t.admin.suggestBody(sg.count, sg.urgent, sg.place)}</p>
            <p className="text-[12.5px] text-label-2">{t.admin.suggestNote}</p>
          </div>
          <Button size="sm" variant="danger" onClick={() => declare({ type: sg.type, name: `${t.admin.zoneTypes[sg.type]} — ${sg.place}`, region: sg.place, center: sg.center, radiusKm: sg.radiusKm })}>
            {t.admin.declare}
          </Button>
        </section>
      ))}

      {active.length === 0 && suggestions.length === 0 && <div className="card rounded-[28px] p-6 text-[15px] text-label-2">{t.admin.noActive}</div>}

      {active.map((z) => {
        const live = zoneStats(z, cases);
        return (
          <section key={z.id} className="card overflow-hidden rounded-[28px]">
            <div className="h-[300px]">
              <MapView cases={cases.filter((c) => c.emergencyZoneId === z.id)} zone={z} interactive={false} initialView={{ longitude: z.center.lng, latitude: z.center.lat, zoom: 10.4, pitch: 40 }} />
            </div>
            <div className="flex flex-wrap items-center gap-4 p-5">
              <Emoji3D src="/3d/fire.png" size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[17px] font-semibold">{z.name}</div>
                <div className="text-[13px] text-label-2">{z.region} · {t.map.zoneType[z.type]} · {t.map.sinceMin(minutesSince(z.startedAt))}</div>
              </div>
              {[
                { n: live.cases, l: t.map.zoneStats.cases },
                { n: live.urgent, l: t.map.zoneStats.urgent },
                { n: live.helpers, l: t.map.zoneStats.helpers },
              ].map((x) => (
                <div key={x.l} className="text-center">
                  <div className="text-[22px] font-bold tabular-nums">{x.n}</div>
                  <div className="text-[11.5px] text-label-2">{x.l}</div>
                </div>
              ))}
              <Button
                size="sm"
                variant="glass"
                onClick={() => {
                  if (!confirm(t.admin.endConfirm)) return;
                  if (apiOn("services")) void zonesApi.update(z.id, { active: false }).catch(() => {});
                  store.endZone(z.id);
                  toast(t.admin.ended);
                }}
              >
                {t.admin.endZone}
              </Button>
            </div>
          </section>
        );
      })}

      {past.length > 0 && (
        <section className="card rounded-[28px] p-5">
          <h3 className="text-[15px] font-semibold text-label-2">{t.admin.past}</h3>
          <div className="mt-2 divide-y divide-separator">
            {past.map((z) => (
              <div key={z.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                <span className="min-w-0 truncate font-medium">{z.name}</span>
                <span className="shrink-0 text-label-2">{fmt(z.startedAt)} → {z.endedAt ? fmt(z.endedAt) : ""}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function UsersTable() {
  const { t } = useI18n();
  const users = useStore((s) => s.users);
  const color: Record<string, string> = { reporter: "var(--label-2)", volunteer: "var(--stable)", vet: "var(--accent)", admin: "var(--accent-2)" };
  return (
    <section className="card overflow-hidden rounded-[28px]">
      <h2 className="p-5 text-[19px] font-bold">{t.admin.users}</h2>
      <div className="divide-y divide-separator border-t border-separator">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-5 py-3">
            <Link href={`/users/${u.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={u.name} photo={u.photo} size={38} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{u.name}</div>
                <div className="truncate text-[12.5px] text-label-2">{u.city ?? "—"}{u.helpTypes?.length ? ` · ${u.helpTypes.map((h) => t.common.help[h]).join(" · ")}` : ""}</div>
              </div>
            </Link>
            {u.phone && (
              <a href={`tel:${u.phone.replace(/\s/g, "")}`} className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-[13px] font-semibold text-accent" dir="ltr" title={u.phone}>
                <Phone className="h-4 w-4" /> <span className="max-md:hidden">{u.phone}</span>
              </a>
            )}
            {u.rating && <span className="text-[13px] font-semibold tabular-nums text-label-2">★ {u.rating}</span>}
            {u.role === "admin" ? (
              <span className="rounded-full px-3 py-1 text-[12.5px] font-semibold" style={{ color: color[u.role], background: `color-mix(in srgb, ${color[u.role]} 14%, transparent)` }}>
                {t.dashboard.roles[u.role]}
              </span>
            ) : (
              <select
                value={u.role}
                aria-label={t.dashboard.roles[u.role]}
                onChange={(e) => {
                  const role = e.target.value as "reporter" | "volunteer" | "vet";
                  if (apiOn("admin")) void adminApi.setRole(u.id, role).catch(() => toast.error(t.auth.errors.UNKNOWN));
                  store.setRole(u.id, role);
                  toast.success(`${u.name} · ${t.dashboard.roles[e.target.value as "reporter"]}`);
                }}
                className="h-9 shrink-0 cursor-pointer appearance-none rounded-full px-3 text-[12.5px] font-semibold outline-none"
                style={{ color: color[u.role], background: `color-mix(in srgb, ${color[u.role]} 14%, transparent)` }}
              >
                {(["reporter", "volunteer", "vet"] as const).map((r) => (
                  <option key={r} value={r}>{t.dashboard.roles[r]}</option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
