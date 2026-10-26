"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Bell, ChevronLeft, Heart, House, LayoutGrid, LogOut, Map, Settings, Shield, Sparkles, Stethoscope } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/brand/Logo";

/** Lowercase rounded wordmark, same as the brand lockup. */
function Wordmark() {
  return <span className="bg-gradient-to-r from-[#1f8bff] via-[#3d6bff] to-[#7b4dff] bg-clip-text font-display text-[22px] font-black leading-none tracking-[-0.03em] text-transparent">pawlink</span>;
}
import { CreateFab, CreateMenuDesktop } from "@/components/layout/CreateMenu";
import { Avatar } from "@/components/ui/primitives";
import { signOut, useSession } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { syncNotifications } from "@/lib/sync";
import { apiOn } from "@/lib/api/client";
import { useTabBarHidden } from "@/lib/ui";
import { useI18n } from "@/lib/i18n";
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
const iconBtn = "flex h-11 md:h-10 items-center justify-center gap-1.5 rounded-full px-2.5 text-label-2 transition-colors hover:bg-black/5 hover:text-label dark:hover:bg-white/10";

export function TopNav({
  floating = false,
  noTabBar = false,
  back,
  actions,
}: {
  floating?: boolean;
  noTabBar?: boolean;
  /** Phones: iOS back button on the left of the bar (detail pages). */
  back?: { href: string; label: string; history?: boolean };
  /** Phones: page actions on the right of the bar (share…). */
  actions?: React.ReactNode;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const user = useSession();
  const { scrollY } = useScroll();
  useEffect(() => { if (user?.id && apiOn("notifications")) syncNotifications(user.id); }, [user?.id]);
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 12));

  const onLanding = pathname === "/";
  const links = [
    { href: "/map", label: t.nav.map },
    { href: "/adopt", label: t.nav.adopt },
    { href: "/services", label: t.nav.services },
    ...(user?.role === "admin" ? [{ href: "/admin", label: t.nav.admin }] : []),
  ];

  return (
    <>
      <motion.header
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 28, delay: 0.1 }}
        className={cn("pointer-events-none fixed inset-x-0 top-0 z-50 justify-center px-3 pt-[max(12px,env(safe-area-inset-top))]", floating ? "hidden md:flex" : "flex")}
      >
        {/* phones: iOS scroll-edge effect, content softly blurs under the floating buttons instead of colliding with them */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-x-0 top-0 h-[calc(100%+20px)] bg-bg/55 backdrop-blur-xl transition-opacity duration-300 [mask-image:linear-gradient(to_bottom,#000_55%,transparent)] md:hidden",
            scrolled && !onLanding && !floating ? "opacity-100" : "opacity-0",
          )}
        />
        <nav
          className={cn(
            "pointer-events-auto relative flex h-14 w-full max-w-[1100px] items-center gap-1 rounded-full pe-2 ps-3 transition-all duration-500",
            // phones: no bar on app pages, just floating round buttons (iOS style)
            onLanding || scrolled || floating ? "md:glass md:glass-sheen" : "md:border md:border-transparent",
            onLanding && scrolled && "glass glass-sheen",
          )}
        >
          {back && (
            <Link
              href={back.href}
              onClick={(e) => {
                // behave like iOS: go back where you came from when there is in-app history
                if (back.history && window.history.length > 1) {
                  e.preventDefault();
                  router.back();
                }
              }}
              className="flex h-11 max-w-[55%] items-center gap-0.5 rounded-full bg-surface pe-4 ps-2 text-[15px] font-semibold shadow-[0_2px_10px_rgba(0,0,0,0.08)] transition-transform active:scale-95 md:hidden"
            >
              <ChevronLeft className="h-5 w-5 shrink-0 rtl:rotate-180" strokeWidth={2.4} />
              <span className="truncate">{back.label}</span>
            </Link>
          )}
          <Link href="/" className={cn("items-center gap-2 pe-2", onLanding ? "flex" : "hidden md:flex")} dir="ltr">
            <AppIcon className="h-8 w-8" />
            <Wordmark />
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
            {actions && <div className="flex items-center gap-1.5 md:hidden">{actions}</div>}
            {/* phones, on Home: the bell sits next to settings (Klarna-style) */}
            {pathname.startsWith("/account") && (
              <div className="me-1.5 md:hidden">
                <NotificationBell />
              </div>
            )}
            <Link href="/settings" aria-label={t.acct.tabs.settings} className={cn(iconBtn, "w-11 px-0 md:w-10 max-md:bg-surface max-md:shadow-[0_2px_10px_rgba(0,0,0,0.08)]", (back || actions) && "max-md:hidden")}>
              <Settings className="h-[18px] w-[18px]" />
            </Link>
            <CreateMenuDesktop />
            {/* phones: notifications and the account live in the "Home" tab; signed-out people get a sign-in pill */}
            <div className="hidden items-center gap-0.5 md:flex">
              <NotificationBell />
              <AccountMenu />
            </div>
            {user === null && (
              <div className="md:hidden">
                <AccountMenu />
              </div>
            )}
          </div>
        </nav>
      </motion.header>
      {!noTabBar && <MobileTabBar />}
    </>
  );
}

function NotificationBell() {
  const { t } = useI18n();
  const user = useSession();
  const unread = useStore((s) => s.notifications.filter((n) => n.userId === user?.id && !n.read).length);
  if (!user) return null;
  return (
    <Link href="/account?tab=notifications" aria-label={t.notif.title} className={cn(iconBtn, "relative w-11 px-0 md:w-10 max-md:ms-1.5 max-md:bg-surface max-md:shadow-[0_2px_10px_rgba(0,0,0,0.08)]")}>
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
  const pathname = usePathname();
  if (user === undefined) return <span className="w-10" />;
  if (!user && pathname === "/login") return null;
  if (!user)
    return (
      <Link href="/login" className="ms-1 flex h-11 items-center rounded-full bg-surface px-4 text-[14px] font-semibold shadow-[0_2px_10px_rgba(0,0,0,0.08)] md:h-9 md:bg-black/[0.06] md:px-3.5 md:shadow-none md:dark:bg-white/10">
        {t.nav.signIn}
      </Link>
    );
  return (
    <div ref={ref} className="relative ms-1">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-95 md:h-10 md:w-10">
        <Avatar name={user.name} size={36} />
      </button>
      <Menu open={open} className="w-60">
        <div className="px-3 pb-2 pt-1.5">
          <div className="truncate text-[15px] font-semibold">{user.name}</div>
          <div className="text-[12.5px] text-label-2">{t.dashboard.roles[user.role]}</div>
        </div>
        <Link href="/account" onClick={() => setOpen(false)} className={item}>
          <LayoutGrid className="h-4 w-4 text-label-2" /> {t.account.mySpace}
        </Link>
        {(
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

/** iOS-style floating tab bar on phones: Home · Adopt · + · Services · Map. */
function MobileTabBar() {
  const { t } = useI18n();
  const hidden = useTabBarHidden();
  const pathname = usePathname();
  const user = useSession();
  const unread = useStore((s) => s.notifications.filter((n) => n.userId === user?.id && !n.read).length);
  const [creating, setCreating] = useState(false);
  const isHome = user ? ["/account", "/admin", "/settings", "/dashboard"].some((p) => pathname.startsWith(p)) : pathname === "/";
  const tabs = [
    { href: user ? "/account" : "/", label: t.home.tab, icon: House, active: isHome, badge: unread },
    { href: "/adopt", label: t.nav.adopt, icon: Heart, active: pathname.startsWith("/adopt") },
    null,
    { href: "/services", label: t.nav.services, icon: Stethoscope, active: pathname.startsWith("/services") },
    { href: "/map", label: t.nav.map, icon: Map, active: pathname.startsWith("/map") },
  ];
  return (
    <motion.div
      animate={{ y: hidden ? 120 : 0, opacity: hidden ? 0 : 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      className={cn("pointer-events-none fixed inset-x-0 bottom-0 flex justify-center px-4 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden", creating ? "z-[73]" : "z-[55]")}
    >
      <nav className="glass-strong pointer-events-auto flex h-[64px] w-full max-w-[420px] items-center justify-around rounded-full px-1.5">
        {tabs.map((tab) => {
          if (!tab) return <CreateFab key="create" onOpenChange={setCreating} />;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn("relative flex h-[52px] w-[66px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors active:opacity-60", tab.active ? "text-accent" : "text-label-2")}
            >
              {tab.active && <motion.span layoutId="tabbar-pill" className="absolute inset-0 rounded-full bg-accent-soft" transition={{ type: "spring", stiffness: 480, damping: 36 }} />}
              <motion.span
                key={tab.active ? "on" : "off"}
                initial={tab.active ? { scale: 0.6, y: 3 } : false}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 520, damping: 14 }}
                className="relative"
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={tab.active ? 2.4 : 1.9} />
                {!!tab.badge && (
                  <span className="absolute -end-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-urgent px-1 text-[10px] font-bold text-white">{tab.badge}</span>
                )}
              </motion.span>
              <span className="relative max-w-full truncate">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </motion.div>
  );
}
