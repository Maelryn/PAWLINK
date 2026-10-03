"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Bell, Check, Globe, Heart, LayoutGrid, LogOut, Map, Moon, Plus, Shield, Sparkles, Stethoscope, Sun, SunMoon, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/primitives";
import { signOut, useSession } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { DICTS, LOCALES, useI18n } from "@/lib/i18n";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

function useClickOutside(onOut: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const f = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && onOut();
    document.addEventListener("pointerdown", f);
    return () => document.removeEventListener("pointerdown", f);
  }, [onOut]);
  return ref;
}

function Menu({ open, children, className }: { open: boolean; children: React.ReactNode; className?: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          style={{ transformOrigin: "top" }}
          className={cn("glass-strong absolute end-0 top-12 z-50 overflow-hidden rounded-[20px] p-1.5", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const item = "flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-[14px] font-medium hover:bg-black/5 dark:hover:bg-white/10";
const iconBtn = "flex h-10 items-center justify-center gap-1.5 rounded-full px-2.5 text-label-2 transition-colors hover:bg-black/5 hover:text-label dark:hover:bg-white/10";

export function TopNav({ floating = false }: { floating?: boolean }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const user = useSession();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 12));

  const links = [
    { href: "/map", label: t.nav.map },
    { href: "/adopt", label: t.nav.adopt },
    { href: "/services", label: t.nav.services },
    ...(user ? [{ href: "/account", label: t.nav.dashboard }] : []),
    ...(user?.role === "admin" ? [{ href: "/admin", label: t.nav.admin }] : []),
  ];

  return (
    <>
      <motion.header
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 28, delay: 0.1 }}
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3"
      >
        <nav
          className={cn(
            "pointer-events-auto flex h-14 w-full max-w-[1100px] items-center gap-1 rounded-full pe-2 ps-3 transition-all duration-500",
            scrolled || floating ? "glass glass-sheen" : "border border-transparent bg-transparent",
          )}
        >
          <Link href="/" className="flex items-center gap-2 pe-2" dir="ltr">
            <AppIcon className="h-8 w-8" />
            <span className="text-[18px] font-semibold tracking-[-0.03em]">
              Paw<span className="text-accent">Link</span>
            </span>
          </Link>

          <div className="mx-auto hidden items-center gap-1 md:flex">
            {links.map((l) => {
              const active = pathname.startsWith(l.href);
              return (
                <Link key={l.href} href={l.href} className={cn("relative rounded-full px-3.5 py-2 text-[14px] font-medium transition-colors", active ? "text-label" : "text-label-2 hover:text-label")}>
                  {active && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-full bg-black/[0.06] dark:bg-white/10" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  {l.label}
                </Link>
              );
            })}
          </div>

          <div className="ms-auto flex items-center gap-0.5 md:ms-0">
            <LanguageMenu />
            <ThemeMenu />
            <ButtonLink href="/report" size="sm" className="ms-1 hidden sm:inline-flex">
              <Plus className="h-4 w-4" strokeWidth={2.6} />
              {t.nav.report}
            </ButtonLink>
            <NotificationBell />
            <AccountMenu />
          </div>
        </nav>
      </motion.header>
      <MobileTabBar />
    </>
  );
}

function ThemeMenu() {
  const { t } = useI18n();
  const { mode, resolved, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const opts: { m: ThemeMode; label: string; hint?: string; Icon: typeof Sun }[] = [
    { m: "auto", label: t.theme.auto, hint: t.theme.autoHint, Icon: SunMoon },
    { m: "light", label: t.theme.light, Icon: Sun },
    { m: "dark", label: t.theme.dark, Icon: Moon },
  ];
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={t.theme.title} onClick={() => setOpen((o) => !o)} className={cn(iconBtn, "w-10 px-0")}>
        {resolved === "dark" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
      </button>
      <Menu open={open} className="w-56">
        {opts.map(({ m, label, hint, Icon }) => (
          <button key={m} type="button" onClick={() => { setMode(m); setOpen(false); }} className={item}>
            <Icon className="h-4 w-4 text-label-2" />
            <span className="flex-1 text-start">
              {label}
              {hint && <span className="block text-[11.5px] font-normal text-label-2">{hint}</span>}
            </span>
            {mode === m && <Check className="h-4 w-4 text-accent" strokeWidth={2.6} />}
          </button>
        ))}
      </Menu>
    </div>
  );
}

function LanguageMenu() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={t.common.language} onClick={() => setOpen((o) => !o)} className={cn(iconBtn, "text-[13px] font-semibold")}>
        <Globe className="h-[17px] w-[17px]" />
        <span className="hidden sm:inline">{DICTS[locale].meta.short}</span>
      </button>
      <Menu open={open} className="w-44">
        {LOCALES.map((l) => (
          <button key={l} type="button" onClick={() => { setLocale(l); setOpen(false); }} className={cn(item, "justify-between")}>
            <span>{DICTS[l].meta.name}</span>
            {l === locale && <Check className="h-4 w-4 text-accent" strokeWidth={2.6} />}
          </button>
        ))}
      </Menu>
    </div>
  );
}

function NotificationBell() {
  const { t } = useI18n();
  const user = useSession();
  const unread = useStore((s) => s.notifications.filter((n) => n.userId === user?.id && !n.read).length);
  if (!user) return null;
  return (
    <Link href="/account?tab=notifications" aria-label={t.notif.title} className={cn(iconBtn, "relative w-10 px-0")}>
      <Bell className="h-[18px] w-[18px]" />
      {unread > 0 && (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-urgent px-1 text-[10px] font-bold text-white">
          {unread}
        </motion.span>
      )}
    </Link>
  );
}

function AccountMenu() {
  const { t } = useI18n();
  const user = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  if (user === undefined) return <span className="w-10" />;
  if (!user)
    return (
      <Link href="/login" className="ms-1 flex h-9 items-center rounded-full bg-black/[0.06] px-3.5 text-[14px] font-semibold dark:bg-white/10">
        {t.nav.signIn}
      </Link>
    );
  return (
    <div ref={ref} className="relative ms-1">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex h-10 w-10 items-center justify-center rounded-full">
        <Avatar name={user.name} size={34} />
      </button>
      <Menu open={open} className="w-60">
        <div className="px-3 pb-2 pt-1.5">
          <div className="truncate text-[15px] font-semibold">{user.name}</div>
          <div className="text-[12.5px] text-label-2">{t.dashboard.roles[user.role]}</div>
        </div>
        <Link href="/account" onClick={() => setOpen(false)} className={item}>
          <LayoutGrid className="h-4 w-4 text-label-2" /> {t.account.mySpace}
        </Link>
        {user.serviceId && (
          <Link href="/pro" onClick={() => setOpen(false)} className={item}>
            <Sparkles className="h-4 w-4 text-label-2" /> PawLink Pro
          </Link>
        )}
        {user.role === "admin" && (
          <Link href="/admin" onClick={() => setOpen(false)} className={item}>
            <Shield className="h-4 w-4 text-label-2" /> {t.nav.admin}
          </Link>
        )}
        <button type="button" onClick={() => { signOut(); setOpen(false); router.push("/"); }} className={cn(item, "text-urgent")}>
          <LogOut className="h-4 w-4" /> {t.account.signOut}
        </button>
      </Menu>
    </div>
  );
}

/** iOS-style floating tab bar on phones. Always visible (pages pad their bottom by 96px). */
function MobileTabBar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const user = useSession();
  const tabs = [
    { href: "/map", label: t.nav.map, icon: Map },
    { href: "/adopt", label: t.nav.adopt, icon: Heart },
    { href: "/report", label: t.nav.report, icon: Plus, primary: true },
    { href: "/services", label: t.nav.services, icon: Stethoscope },
    user ? { href: user.role === "admin" && pathname.startsWith("/admin") ? "/admin" : "/account", label: t.account.mySpace, icon: UserIcon } : { href: "/login", label: t.nav.signIn, icon: UserIcon },
  ];
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[55] flex justify-center px-4 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden">
      <nav className="glass-strong pointer-events-auto flex h-[64px] w-full max-w-[420px] items-center justify-around rounded-full px-2">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          const Icon = tab.icon;
          if (tab.primary)
            return (
              <Link key={tab.href} href={tab.href} aria-label={tab.label} className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_20px_-6px_var(--accent)]">
                <Icon className="h-6 w-6" strokeWidth={2.6} />
              </Link>
            );
          return (
            <Link key={tab.href} href={tab.href} className={cn("relative flex w-16 flex-col items-center gap-0.5 py-1 text-[10px] font-semibold", active ? "text-accent" : "text-label-2")}>
              <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.9} />
              <span className="max-w-full truncate">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
