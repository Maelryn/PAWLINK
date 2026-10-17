"use client";

import { SERVICE_EMOJI } from "@/lib/species";

import { motion } from "motion/react";
import { Bell, Briefcase, Camera, Check, ChevronRight, Heart, House, MapPin, Pencil, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { MyAdoptions } from "@/components/adopt/AdoptionPanels";
import { CaseRow } from "@/components/cases/CaseBits";
import { TrustBadge } from "@/components/cases/Trust";
import { BusinessPanel, PlusSuggestion } from "@/components/account/BusinessPanel";
import { TopNav } from "@/components/layout/TopNav";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Avatar, Emoji3D, TimeAgo } from "@/components/ui/primitives";
import { useSession, saveProfile } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { HELP_EMOJI, TRIAGE_ORDER } from "@/lib/species";
import { isPublic, proActive, store, useStore } from "@/lib/store";
import { availabilityOf, type Availability } from "@/lib/people";
import { openPaywall } from "@/lib/ui";
import type { HelpType, User, ServiceType } from "@/lib/types";
import { cn, distanceKm } from "@/lib/utils";

type Tab = "home" | "profile" | "reports" | "adoption" | "pro" | "notifications";

/** "Good morning" / "Good evening"… from the device clock. */
function greeting(t: ReturnType<typeof useI18n>["t"]) {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? t.home.morning : h >= 12 && h < 18 ? t.home.afternoon : t.home.evening;
}
/** "Yasmine", or "Dr Meriem" for vets. */
function firstName(name: string) {
  const parts = name.replace(/^Dr\.?\s*/, "Dr ").split(" ");
  return parts[0] === "Dr" ? parts.slice(0, 2).join(" ") : parts[0];
}

export default function AccountPage() {
  return (
    <Suspense>
      <Account />
    </Suspense>
  );
}

function Account() {
  const { t } = useI18n();
  const me = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const unread = useStore((s) => s.notifications.filter((n) => n.userId === me?.id && !n.read).length);
  if (!me) return null;

  const tabs: { id: Tab; label: string; Icon: typeof House; badge?: number }[] = [
    { id: "home", label: t.home.tab, Icon: House },
    { id: "reports", label: t.acct.tabs.reports, Icon: MapPin },
    { id: "adoption", label: t.acct.tabs.adoption, Icon: Heart },
    ...(me.serviceId ? [{ id: "pro" as Tab, label: t.acct.tabs.pro, Icon: Briefcase }] : []),
    { id: "notifications", label: t.acct.tabs.notifications, Icon: Bell, badge: unread },
    // the profile comes last: what you do (reports, animals) matters more day to day
    { id: "profile", label: t.acct.tabs.profile, Icon: UserIcon },
  ];
  const tab = (tabs.find((x) => x.id === params.get("tab"))?.id ?? "home") as Tab;
  const go = (id: Tab) => router.replace(`/account?tab=${id}`, { scroll: false });

  return (
    <div className="min-h-[100svh] pb-32">
      <TopNav />
      <div className="mx-auto max-w-[1100px] px-4 pt-[76px] sm:pt-24">
        {/* header: a personal hello */}
        <div className="flex items-center gap-3.5">
          <button type="button" onClick={() => go("profile")} className="shrink-0 rounded-full transition-transform active:scale-95" aria-label={t.acct.tabs.profile}>
            <Avatar name={me.name} photo={me.photo} size={60} />
          </button>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-label-2">{greeting(t)}</div>
            <h1 className="flex items-center gap-2 text-[28px] font-black leading-tight tracking-[-0.035em] sm:text-[34px]">
              <span className="truncate">{firstName(me.name)}</span>
              <motion.span className="inline-block origin-[70%_70%]" animate={{ rotate: [0, 16, -8, 16, 0] }} transition={{ duration: 1.2, delay: 0.4 }} aria-hidden>
                👋
              </motion.span>
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 text-[13.5px] text-label-2">
              {/* a plain blue link, like iOS / Instagram ("Modifier le profil"), not a button */}
              <button type="button" onClick={() => go("profile")} className="flex items-center gap-0.5 font-semibold text-accent transition-opacity active:opacity-60">
                {t.acct.editProfile} <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </button>
              {me.city && <span className="flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{me.city}</span></span>}
              {me.pro && new Date(me.pro.until) > new Date() && <span className="rounded-full bg-gradient-to-r from-[#0a7cff] to-[#5e5ce6] px-2 py-0.5 text-[11px] font-bold text-white">{me.pro.plan === "plus" ? "PRO+" : "PRO"}</span>}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
          {/* tabs: sidebar on desktop, scrollable pills on phones */}
          <nav className="scroll-fade lg-no-fade -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar lg:mx-0 lg:flex-col lg:self-start lg:px-0">
            {tabs.map(({ id, label, Icon, badge }) => (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                className={cn(
                  "relative flex shrink-0 items-center gap-2.5 rounded-full px-3.5 py-2 text-[14px] font-medium transition-colors lg:rounded-[12px] lg:py-2.5",
                  tab === id ? "text-white" : "bg-surface-2 text-label hover:bg-surface-3 lg:bg-transparent lg:hover:bg-black/5 dark:lg:hover:bg-white/10",
                )}
              >
                {tab === id && <motion.span layoutId="acct-tab" className="absolute inset-0 rounded-full bg-accent lg:rounded-[12px]" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
                <Icon className="relative h-[17px] w-[17px]" />
                <span className="relative whitespace-nowrap">{label}</span>
                {!!badge && <span className="relative ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-urgent px-1.5 text-[11px] font-bold text-white">{badge}</span>}
              </button>
            ))}
          </nav>

          <motion.main key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="min-w-0 space-y-5">
            {tab === "home" && <Overview me={me} go={go} />}
            {tab === "profile" && <Profile me={me} />}
            {tab === "reports" && <MyReports me={me} />}
            {tab === "adoption" && <MyAdoptions me={me} />}
            {tab === "pro" && <BusinessPanel me={me} />}
            {tab === "notifications" && <Notifications me={me} />}
          </motion.main>
        </div>
      </div>
    </div>
  );
}

const card = "card rounded-[28px] p-5";

function Overview({ me, go }: { me: User; go: (t: Tab) => void }) {
  const { t, locale } = useI18n();
  const cases = useStore((s) => s.cases);
  const adoptions = useStore((s) => s.adoptions);
  const myService = useStore((s) => s.services).find((x) => x.id === me.serviceId);
  const home = me.location ?? { lat: 36.7538, lng: 3.0588 };
  const myReports = cases.filter((c) => c.reporter.id === me.id).length;
  const helped = cases.filter((c) => c.helpers.some((h) => h.user.id === me.id)).length;
  const listings = adoptions.filter((a) => a.ownerId === me.id).length;
  const open = cases
    .filter((c) => isPublic(c) && c.status !== "resolved")
    .map((c) => ({ c, d: distanceKm(home, c.location) }))
    .sort((a, b) => TRIAGE_ORDER[a.c.triage] - TRIAGE_ORDER[b.c.triage] || a.d - b.d);
  const urgentNear = open.filter((x) => x.c.triage === "urgent" && x.d < 40).length;
  const near = open.slice(0, 3);
  const bizNoPro = myService?.status === "approved" && !proActive(me);
  // Pro businesses only hear about Pro+ once they are actually busy (bookings / reviews), at most once a week
  const busy = useStore((s) => s.bookings.filter((b) => b.serviceId === me.serviceId).length >= 3 || s.reviews.filter((r) => r.serviceId === me.serviceId).length >= 5);
  return (
    <>
      {/* what matters right now, in one glance */}
      <Link
        href="/map"
        className={cn(
          "relative block overflow-hidden rounded-[30px] p-5 text-white transition-transform active:scale-[0.98]",
          urgentNear ? "bg-gradient-to-br from-[#ff7a45] via-[#ff4d5e] to-[#ff2d78]" : "bg-gradient-to-br from-[#30c46b] via-[#1fa98f] to-[#0a7cff]",
        )}
      >
        <motion.div className="absolute -end-2 -top-2" animate={{ y: [0, -6, 0], rotate: [0, -4, 0] }} transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}>
          <Emoji3D src={urgentNear ? "/3d/ambulance.png" : "/3d/sun.png"} size={92} className="drop-shadow-[0_12px_18px_rgba(0,0,0,0.2)]" />
        </motion.div>
        <div className="relative max-w-[72%] text-[21px] font-bold leading-tight tracking-[-0.02em]">{t.home.near(urgentNear)}</div>
        <p className="relative mt-1.5 max-w-[80%] text-[13.5px] leading-snug text-white/85">{urgentNear ? t.home.nearBody : t.home.calmBody}</p>
        <span className="relative mt-4 inline-flex h-10 items-center gap-1 rounded-full bg-white px-4 text-[14px] font-bold text-[#1d1d1f]">
          {t.home.nearCta} <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </span>
      </Link>

      <div className="grid grid-cols-3 gap-3">
        {[
          { e: "/3d/camera.png", n: myReports, l: t.acct.stats.reports, tab: "reports" as Tab, bg: "from-[#fff0e6] to-[#ffe0cc] dark:from-[#3a2418] dark:to-[#2a1a12]" },
          { e: "/3d/hearthands.png", n: helped, l: t.acct.stats.helped, tab: "reports" as Tab, bg: "from-[#ffe8f0] to-[#ffd3e2] dark:from-[#3a1826] dark:to-[#2a121c]" },
          { e: "/3d/home.png", n: listings, l: t.acct.stats.listings, tab: "adoption" as Tab, bg: "from-[#e6f7ee] to-[#cdeedd] dark:from-[#16301f] dark:to-[#112418]" },
        ].map((s, i) => (
          <motion.button
            key={s.l}
            type="button"
            onClick={() => go(s.tab)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.05 }}
            whileTap={{ scale: 0.94 }}
            className={cn("flex min-w-0 flex-col items-start gap-2 rounded-[24px] bg-gradient-to-br p-4 text-start", s.bg)}
          >
            <Emoji3D src={s.e} size={34} />
            <div className="text-[26px] font-bold leading-none tabular-nums">{s.n}</div>
            <div className="text-[12.5px] leading-tight text-label-2">{s.l}</div>
          </motion.button>
        ))}
      </div>

      {/* one personal card: admin console, Pro for businesses, or becoming a verified professional */}
      {me.role === "admin" ? (
        <Link href="/admin" className="card flex items-center gap-3 rounded-[24px] p-4 transition-transform active:scale-[0.98]">
          <Emoji3D src="/3d/shield.png" size={40} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-bold">{t.home.admin}</div>
            <div className="truncate text-[13px] text-label-2">{t.home.adminBody}</div>
          </div>
          <ChevronRight className="h-4 w-4 text-label-3 rtl:rotate-180" />
        </Link>
      ) : bizNoPro ? (
        <button type="button" onClick={() => openPaywall()} className="relative flex w-full items-center gap-3 overflow-hidden rounded-[24px] bg-gradient-to-r from-[#0a7cff] via-[#5e5ce6] to-[#ff2d78] p-4 text-start text-white transition-transform active:scale-[0.98]">
          <motion.span animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.5 }} className="shrink-0">
            <Emoji3D src="/3d/star.png" size={40} />
          </motion.span>
          <div className="min-w-0 flex-1">
            <div className="font-bold">{t.biz.proTitle}</div>
            <div className="line-clamp-2 text-[13px] text-white/85">{t.biz.proPitch}</div>
          </div>
          <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[13px] font-bold text-[#3d3bd6]">{t.home.proCta}</span>
        </button>
      ) : me.serviceId && proActive(me) ? (
        <>
          {/* Pro is visible: what you have, until when, one tap to manage it */}
          <Link href="/account?tab=pro" className="relative flex items-center gap-3 overflow-hidden rounded-[24px] bg-gradient-to-r from-[#0a7cff] via-[#3d6bff] to-[#5e5ce6] p-4 text-white transition-transform active:scale-[0.98]">
            <Emoji3D src="/3d/star.png" size={40} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-bold">{me.pro?.plan === "plus" ? `PawLink ${t.pay.tiers.plus}` : t.biz.proTitle} ✓</div>
              <div className="truncate text-[13px] text-white/85">{t.biz.proActive} {new Date(me.pro!.until).toLocaleDateString(locale === "ar" ? "ar-DZ" : locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long" })}</div>
            </div>
            <span className="shrink-0 rounded-full bg-white/20 px-3 py-1.5 text-[13px] font-bold">{t.home.manage}</span>
          </Link>
          <PlusSuggestion me={me} busy={busy} />
        </>
      ) : !me.serviceId ? (
        <Link href="/account?tab=profile#business" className="card flex items-center gap-3 rounded-[24px] p-4 transition-transform active:scale-[0.98]">
          <Emoji3D src="/3d/stethoscope.png" size={40} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-bold">{t.create.pro}</div>
            <div className="truncate text-[13px] text-label-2">{t.create.proSub}</div>
          </div>
          <ChevronRight className="h-4 w-4 text-label-3 rtl:rotate-180" />
        </Link>
      ) : null}

      {/* the ad Pro businesses pay for: a featured vet / shop near you, clearly marked */}
      {!me.serviceId && me.role !== "admin" && <Sponsored near={home} />}

      <section className="card rounded-[28px] p-3">
        <div className="flex items-baseline justify-between gap-3 px-3 pb-1 pt-3">
          <h2 className="min-w-0 text-[20px] font-bold tracking-[-0.02em]">{t.dashboard.near}</h2>
          <Link href="/map" className="shrink-0 py-2 text-[14px] font-semibold text-accent">{t.common.seeAll}</Link>
        </div>
        {near.map(({ c, d }) => (
          <Link key={c.id} href={`/cases/${c.id}`}>
            <CaseRow c={c} distance={d} />
          </Link>
        ))}
      </section>
    </>
  );
}

/** Shrinks a picked photo to 256px so it fits in local storage (Cloudinary will do this for real). */
async function toAvatar(file: File) {
  const img = await createImageBitmap(file);
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const k = Math.max(s / img.width, s / img.height);
  c.getContext("2d")!.drawImage(img, (s - img.width * k) / 2, (s - img.height * k) / 2, img.width * k, img.height * k);
  return c.toDataURL("image/jpeg", 0.85);
}

const field = "h-12 w-full rounded-[16px] bg-surface-2 px-4 text-[15px] outline-none ring-accent/40 placeholder:text-label-2 focus:ring-2";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block ps-1 text-[13px] font-semibold text-label-2">{label}</span>
      {children}
    </label>
  );
}

function Profile({ me }: { me: User }) {
  const { t } = useI18n();
  const [f, setF] = useState({ name: me.name, phone: me.phone ?? "", city: me.city ?? "", bio: me.bio ?? "" });
  const [skills, setSkills] = useState<HelpType[]>(me.helpTypes ?? []);
  const [availability, setAvailability] = useState<Availability>(availabilityOf(me));
  const [photo, setPhoto] = useState(me.photo);
  const up = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        // the API keeps the on/off flag; the 3-level choice is kept with the demo data for now
        const r = await saveProfile(me.id, { ...f, photo, helpTypes: skills, available: availability === "now" });
        if ("error" in r) return toast.error(r.message ?? t.auth.errors.UNKNOWN);
        store.updateUser(me.id, { availability });
        toast.success(t.acct.saved);
      }}
    >
      <Link href={`/users/${me.id}`} className="flex items-center justify-between rounded-[20px] bg-accent-soft px-4 py-3 text-[14.5px] font-semibold text-accent transition-transform active:scale-[0.98]">
        {t.profile.seeMine} <ChevronRight className="h-4 w-4 rtl:rotate-180" />
      </Link>
      <section className={cn(card, "space-y-3")}>
        <div className="flex items-center gap-4">
          <Avatar name={f.name || me.name} photo={photo} size={72} />
          <label className="flex h-11 cursor-pointer items-center gap-2 rounded-full bg-surface-2 px-4 text-[14px] font-semibold transition-transform active:scale-95">
            <Camera className="h-4 w-4" /> {t.acct.photo}
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => e.target.files?.[0] && setPhoto(await toAvatar(e.target.files[0]))} />
          </label>
        </div>
        <Labeled label={t.acct.name}>
          <input required value={f.name} onChange={(e) => up("name", e.target.value)} className={field} autoComplete="name" />
        </Labeled>
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label={t.acct.phone}>
            <div className="relative">
              <input type="tel" value={f.phone} onChange={(e) => up("phone", e.target.value)} placeholder="+213 5XX XX XX XX" className={field} dir="ltr" autoComplete="tel" />
              {/* the badge only belongs to the number that was actually verified */}
              {me.phoneVerified && !!me.phone && f.phone.trim() === me.phone && (
                <span className="pointer-events-none absolute end-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[12px] font-semibold text-stable"><Check className="h-3.5 w-3.5" /> {t.acct.verified}</span>
              )}
            </div>
          </Labeled>
          <Labeled label={t.acct.city}>
            <input value={f.city} onChange={(e) => up("city", e.target.value)} className={field} autoComplete="address-level2" />
          </Labeled>
        </div>
        <Labeled label={t.acct.bio}>
          <textarea rows={3} value={f.bio} onChange={(e) => up("bio", e.target.value)} placeholder={t.acct.bioPh} className={cn(field, "h-auto resize-none py-3")} />
        </Labeled>
      </section>

      <section className={cn(card, "space-y-3")}>
        <h2 className="text-[18px] font-bold">{t.acct.skills}</h2>
        {/* availability: now / usually / not right now (only "away" stops new case suggestions) */}
        <div>
          <div className="text-[14px] font-semibold">{t.availability.title}</div>
          <p className="text-[12.5px] text-label-2">{t.availability.hint}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {AVAIL.map((a) => {
              const on = availability === a.id;
              return (
                <motion.button
                  key={a.id}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setAvailability(a.id)}
                  aria-pressed={on}
                  className={cn("flex min-h-12 items-center gap-3 rounded-[16px] border px-3.5 py-2.5 text-start text-[14px] font-semibold transition-colors", on ? a.on : "border-separator")}
                >
                  <span className={cn("relative flex h-3 w-3 shrink-0 rounded-full", a.dot)}>
                    {on && a.id === "now" && <span className="pulse-ring absolute inset-0 rounded-full bg-stable" />}
                  </span>
                  <span className="flex-1">{t.availability[a.id]}</span>
                  {on && <Check className="h-4 w-4 shrink-0" strokeWidth={3} />}
                </motion.button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(HELP_EMOJI) as HelpType[]).map((h) => {
            const on = skills.includes(h);
            return (
              <button key={h} type="button" onClick={() => setSkills(on ? skills.filter((x) => x !== h) : [...skills, h])} className={cn("flex items-center gap-2 rounded-[16px] border p-2.5 text-[13.5px] font-semibold", on ? "border-accent bg-accent-soft text-accent" : "border-separator")}>
                <Emoji3D src={HELP_EMOJI[h]} size={24} /> {t.common.help[h]}
              </button>
            );
          })}
        </div>
      </section>
      <Button type="submit" size="lg" className="w-full sm:w-auto">{t.acct.save}</Button>
      {!me.serviceId && me.role !== "admin" && <BecomeBusiness me={me} />}
    </form>
  );
}

const AVAIL: { id: Availability; dot: string; on: string }[] = [
  { id: "now", dot: "bg-stable", on: "border-stable bg-stable-soft text-stable" },
  { id: "usually", dot: "bg-monitor", on: "border-monitor bg-monitor-soft text-monitor" },
  { id: "away", dot: "bg-label-3", on: "border-label-3 bg-surface-2 text-label" },
];

const BIZ_TYPES: ServiceType[] = ["vet", "shelter", "transport", "boarding", "training", "store"];

/** Regular accounts ask to become a professional; an admin verifies it before Pro is possible. */
function BecomeBusiness({ me }: { me: User }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [b, setB] = useState({ name: "", type: "vet" as ServiceType, city: me.city ?? "", phone: me.phone ?? "" });
  const input = "h-12 w-full rounded-[16px] bg-surface-2 px-4 text-[15px] outline-none ring-accent/40 placeholder:text-label-2 focus:ring-2";
  return (
    <section id="business" className={cn(card, "scroll-mt-28 space-y-3")}>
      <div className="flex items-start gap-3">
        <Emoji3D src="/3d/home.png" size={36} className="shrink-0" />
        <div>
          <h2 className="text-[18px] font-bold">{t.biz.requestTitle}</h2>
          <p className="text-[13.5px] text-label-2">{t.biz.requestBody}</p>
        </div>
      </div>
      {!open ? (
        <Button type="button" variant="tinted" onClick={() => setOpen(true)}>{t.biz.requestCta}</Button>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {BIZ_TYPES.map((ty) => (
              <button key={ty} type="button" onClick={() => setB({ ...b, type: ty })} className={cn("flex h-10 items-center gap-1.5 rounded-full pe-3.5 ps-2 text-[13.5px] font-semibold transition-colors", b.type === ty ? "bg-accent-soft text-accent ring-2 ring-accent" : "bg-surface-2")}>
                <Emoji3D src={SERVICE_EMOJI[ty]} size={22} /> {t.common.service[ty]}
              </button>
            ))}
          </div>
          <input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} placeholder={t.biz.bizName} className={input} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={b.city} onChange={(e) => setB({ ...b, city: e.target.value })} placeholder={t.acct.city} className={input} />
            <input type="tel" value={b.phone} onChange={(e) => setB({ ...b, phone: e.target.value })} placeholder="+213 5XX XX XX XX" className={input} dir="ltr" />
          </div>
          <Button
            type="button"
            disabled={b.name.trim().length < 2 || !b.city.trim() || b.phone.replace(/\D/g, "").length < 8}
            onClick={() => {
              store.requestBusiness(me.id, { name: b.name.trim(), type: b.type, city: b.city.trim(), phone: b.phone.trim(), location: me.location });
              toast.success(t.biz.requestSent);
            }}
          >
            {t.biz.requestCta}
          </Button>
        </div>
      )}
    </section>
  );
}

function MyReports({ me }: { me: User }) {
  const { t } = useI18n();
  const mine = useStore((s) => s.cases).filter((c) => c.reporter.id === me.id);
  if (!mine.length)
    return (
      <section className={cn(card, "flex flex-col items-center gap-3 py-12 text-center")}>
        <Emoji3D src="/3d/owl.png" size={72} />
        <p className="text-label-2">{t.acct.noReports}</p>
        <ButtonLink href="/report">{t.acct.reportCta}</ButtonLink>
      </section>
    );
  return (
    <section className="card rounded-[28px] p-3">
      {mine.map((c) => (
        <div key={c.id} className="relative">
        <Link href={`/cases/${c.id}`} className="block">
          <CaseRow c={c} />
          <div className="flex flex-wrap items-center gap-2 pb-3 pe-14 ps-3">
            {c.trust && <TrustBadge level={c.trust.level} />}
            {c.moderation === "pending" && <span className="rounded-full bg-monitor-soft px-2.5 py-1 text-[12px] font-semibold text-monitor">{t.market.pending}</span>}
            {c.pendingEdit && <span className="rounded-full bg-monitor-soft px-2.5 py-1 text-[12px] font-semibold text-monitor">{t.post.pending}</span>}
            <span className="text-[12.5px] text-label-2">{t.common.helpers(c.helpers.length)}</span>
          </div>
        </Link>
          <Link href={`/cases/${c.id}?edit=1`} className="absolute bottom-2 end-2 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-label-2 transition-transform active:scale-90" aria-label={t.verify.edit} title={t.verify.edit}>
            <Pencil className="h-4 w-4" />
          </Link>
        </div>
      ))}
    </section>
  );
}

function Notifications({ me }: { me: User }) {
  const { t } = useI18n();
  const list = useStore((s) => s.notifications).filter((n) => n.userId === me.id);
  if (!list.length)
    return (
      <section className={cn(card, "flex flex-col items-center gap-3 py-12 text-center text-label-2")}>
        <Emoji3D src="/3d/bell.png" size={64} /> {t.acct.noNotif}
      </section>
    );
  return (
    <section className="card rounded-[28px] p-2">
      <div className="flex justify-end p-2">
        <button type="button" onClick={() => store.markAllRead(me.id)} className="h-10 rounded-full px-3 text-[13.5px] font-semibold text-accent transition-colors hover:bg-accent-soft">{t.acct.markRead}</button>
      </div>
      {list.map((n) => (
        <Link key={n.id} href={n.href} onClick={() => store.markRead(n.id)} className={cn("flex items-center gap-3 rounded-[18px] p-3 hover:bg-surface-2", !n.read && "bg-accent-soft/60")}>
          <Emoji3D src="/3d/bell.png" size={30} />
          <div className="min-w-0 flex-1">
            <div className="text-[14.5px]">{t.notif[n.kind](n.subject)}</div>
            <div className="text-[12px] text-label-2"><TimeAgo iso={n.createdAt} /></div>
          </div>
          {!n.read && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
          <ChevronRight className="h-4 w-4 text-label-3 rtl:rotate-180" />
        </Link>
      ))}
    </section>
  );
}

/** One Pro listing near you, labelled "Sponsored". Pro businesses pay for this placement (PawLink never sells data). */
function Sponsored({ near }: { near: { lat: number; lng: number } }) {
  const { t } = useI18n();
  const s = useStore((st) => st.services)
    .filter((x) => x.status === "approved" && x.pro)
    .map((x) => ({ x, d: distanceKm(near, x.location) }))
    .sort((a, b) => a.d - b.d)[0];
  if (!s) return null;
  return (
    <Link href={`/services/${s.x.id}`} className="card relative flex items-center gap-3 overflow-hidden rounded-[24px] p-4 transition-transform active:scale-[0.98]">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#e3efff] to-[#c9dcff]">
        <Emoji3D src={SERVICE_EMOJI[s.x.type]} size={36} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-label-3">{t.home.sponsored}</div>
        <div className="truncate font-bold">{s.x.name}</div>
        <div className="truncate text-[13px] text-label-2">
          ★ {s.x.rating.toFixed(1)} · {t.common.service[s.x.type]} · {t.common.km(s.d)}
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-[13px] font-bold text-white">{t.map.details}</span>
    </Link>
  );
}
