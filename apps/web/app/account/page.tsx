"use client";

import { motion } from "motion/react";
import { Bell, Briefcase, Camera, Check, ChevronRight, Heart, Home, MapPin, Settings, User as UserIcon, PlusCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { MyAdoptions } from "@/components/adopt/AdoptionPanels";
import { CaseRow } from "@/components/cases/CaseBits";
import { TrustBadge } from "@/components/cases/Trust";
import { BusinessPanel } from "@/components/account/BusinessPanel";
import { SettingsPanel } from "@/components/account/SettingsPanel";
import { TopNav } from "@/components/layout/TopNav";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Avatar, Emoji3D, TimeAgo } from "@/components/ui/primitives";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { HELP_EMOJI, TRIAGE_ORDER } from "@/lib/species";
import { isPublic, store, useStore } from "@/lib/store";
import type { HelpType, User } from "@/lib/types";
import { cn, distanceKm } from "@/lib/utils";

type Tab = "home" | "profile" | "reports" | "adoption" | "pro" | "notifications" | "settings";

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

  const tabs: { id: Tab; label: string; Icon: typeof Home; badge?: number }[] = [
    { id: "home", label: t.acct.tabs.home, Icon: Home },
    { id: "profile", label: t.acct.tabs.profile, Icon: UserIcon },
    { id: "reports", label: t.acct.tabs.reports, Icon: MapPin },
    { id: "adoption", label: t.acct.tabs.adoption, Icon: Heart },
    ...(me.serviceId ? [{ id: "pro" as Tab, label: t.acct.tabs.pro, Icon: Briefcase }] : []),
    { id: "notifications", label: t.acct.tabs.notifications, Icon: Bell, badge: unread },
    { id: "settings", label: t.acct.tabs.settings, Icon: Settings },
  ];
  const tab = (tabs.find((x) => x.id === params.get("tab"))?.id ?? "home") as Tab;
  const go = (id: Tab) => router.replace(`/account?tab=${id}`, { scroll: false });

  return (
    <div className="min-h-[100svh] pb-32">
      <TopNav />
      <div className="mx-auto max-w-[1100px] px-4 pt-[76px] sm:pt-24">
        {/* header */}
        <div className="flex items-center gap-4">
          <Avatar name={me.name} photo={me.photo} size={64} />
          <div className="min-w-0">
            <h1 className="truncate text-[28px] font-bold tracking-[-0.035em] sm:text-[34px]">{me.name}</h1>
            <div className="flex flex-wrap items-center gap-x-2 text-[13.5px] text-label-2">
              <span className="font-semibold text-accent">{me.serviceId && me.role !== "vet" ? t.biz.signupAs.split(" (")[0] : t.dashboard.roles[me.role]}</span>
              {me.city && <span>· {me.city}</span>}
              {me.pro && <span className="rounded-full bg-gradient-to-r from-[#0a7cff] to-[#5e5ce6] px-2 py-0.5 text-[11px] font-bold text-white">PRO</span>}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[230px_1fr]">
          {/* tabs: sidebar on desktop, scrollable pills on phones */}
          <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar lg:mx-0 lg:flex-col lg:self-start lg:px-0">
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
            {tab === "settings" && <SettingsTab />}
          </motion.main>
        </div>
      </div>
    </div>
  );
}

const card = "card rounded-[28px] p-5";

function Overview({ me, go }: { me: User; go: (t: Tab) => void }) {
  const { t } = useI18n();
  const cases = useStore((s) => s.cases);
  const adoptions = useStore((s) => s.adoptions);
  const home = me.location ?? { lat: 36.7538, lng: 3.0588 };
  const myReports = cases.filter((c) => c.reporter.id === me.id).length;
  const helped = cases.filter((c) => c.helpers.some((h) => h.user.id === me.id)).length;
  const listings = adoptions.filter((a) => a.ownerId === me.id).length;
  const near = cases
    .filter((c) => isPublic(c) && c.status !== "resolved")
    .map((c) => ({ c, d: distanceKm(home, c.location) }))
    .sort((a, b) => TRIAGE_ORDER[a.c.triage] - TRIAGE_ORDER[b.c.triage] || a.d - b.d)
    .slice(0, 5);
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {[
          { e: "/3d/camera.png", n: myReports, l: t.acct.stats.reports, tab: "reports" as Tab },
          { e: "/3d/hearthands.png", n: helped, l: t.acct.stats.helped, tab: "home" as Tab },
          { e: "/3d/home.png", n: listings, l: t.acct.stats.listings, tab: "adoption" as Tab },
        ].map((s) => (
          <button key={s.l} type="button" onClick={() => go(s.tab)} className="card flex min-w-0 flex-col items-start gap-2 rounded-[24px] p-4 text-start">
            <Emoji3D src={s.e} size={36} />
            <div className="text-[26px] font-bold leading-none tabular-nums">{s.n}</div>
            <div className="text-[12.5px] leading-tight text-label-2">{s.l}</div>
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ButtonLink href="/report" size="lg" className="w-full">
          <Camera className="h-[18px] w-[18px]" /> {t.acct.reportCta}
        </ButtonLink>
        <ButtonLink href="/adopt/new" size="lg" variant="tinted" className="w-full">
          <PlusCircle className="h-[18px] w-[18px]" /> {t.market.post}
        </ButtonLink>
      </div>
      <section className="card rounded-[28px] p-3">
        <div className="flex items-center justify-between px-3 pb-1 pt-3">
          <h2 className="text-[20px] font-bold tracking-[-0.02em]">{t.dashboard.near}</h2>
          <Link href="/map" className="text-[14px] font-semibold text-accent">{t.common.seeAll}</Link>
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

function Profile({ me }: { me: User }) {
  const { t } = useI18n();
  const [f, setF] = useState({ name: me.name, phone: me.phone ?? "", city: me.city ?? "", bio: me.bio ?? "" });
  const [skills, setSkills] = useState<HelpType[]>(me.helpTypes ?? []);
  const [available, setAvailable] = useState(!!me.available);
  const [photo, setPhoto] = useState(me.photo);
  const up = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        store.updateUser(me.id, { ...f, photo, helpTypes: skills, available });
        toast.success(t.acct.saved);
      }}
    >
      <section className={cn(card, "space-y-3")}>
        <div className="flex items-center gap-4">
          <Avatar name={f.name || me.name} photo={photo} size={72} />
          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-full bg-surface-2 px-4 text-[14px] font-semibold">
            <Camera className="h-4 w-4" /> {t.acct.photo}
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => e.target.files?.[0] && setPhoto(await toAvatar(e.target.files[0]))} />
          </label>
        </div>
        <input required value={f.name} onChange={(e) => up("name", e.target.value)} placeholder={t.acct.name} className={field} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <input value={f.phone} onChange={(e) => up("phone", e.target.value)} placeholder={t.acct.phone} className={field} dir="ltr" />
            {me.phoneVerified && <span className="absolute end-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[12px] font-semibold text-stable"><Check className="h-3.5 w-3.5" /> {t.acct.verified}</span>}
          </div>
          <input value={f.city} onChange={(e) => up("city", e.target.value)} placeholder={t.acct.city} className={field} />
        </div>
        <textarea rows={3} value={f.bio} onChange={(e) => up("bio", e.target.value)} placeholder={t.acct.bioPh} className={cn(field, "h-auto resize-none py-3")} />
      </section>

      <section className={cn(card, "space-y-3")}>
        <h2 className="text-[18px] font-bold">{t.acct.skills}</h2>
        <button type="button" onClick={() => setAvailable((v) => !v)} className={cn("flex w-full items-center gap-3 rounded-[18px] p-3.5", available ? "bg-stable-soft" : "bg-surface-2")}>
          <span className={cn("h-3 w-3 rounded-full", available ? "bg-stable" : "bg-label-3")} />
          <span className="flex-1 text-start text-[15px] font-semibold">{t.acct.available}</span>
          <span className={cn("relative h-[31px] w-[51px] rounded-full p-[2px] transition-colors", available ? "bg-stable" : "bg-label-3/50")}>
            <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 34 }} className={cn("block h-[27px] w-[27px] rounded-full bg-white shadow", available && "ms-auto")} />
          </span>
        </button>
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
    </form>
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
        <Link key={c.id} href={`/cases/${c.id}`} className="block">
          <CaseRow c={c} />
          <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
            {c.trust && <TrustBadge level={c.trust.level} />}
            {c.moderation === "pending" && <span className="rounded-full bg-monitor-soft px-2.5 py-1 text-[12px] font-semibold text-monitor">{t.market.pending}</span>}
            <span className="text-[12.5px] text-label-2">{t.common.helpers(c.helpers.length)}</span>
          </div>
        </Link>
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
        <button type="button" onClick={() => store.markAllRead(me.id)} className="text-[13.5px] font-semibold text-accent">{t.acct.markRead}</button>
      </div>
      {list.map((n) => (
        <Link key={n.id} href={n.href} className={cn("flex items-center gap-3 rounded-[18px] p-3 hover:bg-surface-2", !n.read && "bg-accent-soft/60")}>
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

function SettingsTab() {
  return <SettingsPanel />;
}
