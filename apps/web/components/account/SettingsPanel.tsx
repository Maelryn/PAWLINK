"use client";

import { ChevronRight, Globe, LogOut, Moon, Sun, SunMoon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Emoji3D } from "@/components/ui/primitives";
import { signOut, useSession } from "@/lib/auth";
import { DICTS, LOCALES, useI18n } from "@/lib/i18n";
import { store } from "@/lib/store";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** iOS Settings-style grouped list. Used by /settings (everyone) and the account page. */
export function SettingsPanel() {
  const { t, locale, setLocale } = useI18n();
  const { mode, setMode } = useTheme();
  const me = useSession();
  const router = useRouter();

  const themes: { m: ThemeMode; label: string; hint?: string; Icon: typeof Sun; tint: string }[] = [
    { m: "auto", label: t.theme.auto, hint: t.theme.autoHint, Icon: SunMoon, tint: "#5e5ce6" },
    { m: "light", label: t.theme.light, Icon: Sun, tint: "#ff9500" },
    { m: "dark", label: t.theme.dark, Icon: Moon, tint: "#1c1c1e" },
  ];

  return (
    <div className="space-y-6">
      <Group title={t.acct.language}>
        {LOCALES.map((l) => (
          <Row key={l} onClick={() => setLocale(l)} icon={<Tile tint="#0a7cff"><Globe className="h-[17px] w-[17px]" /></Tile>} label={DICTS[l].meta.name} checked={locale === l} />
        ))}
      </Group>

      <Group title={t.acct.theme}>
        {themes.map(({ m, label, hint, Icon, tint }) => (
          <Row key={m} onClick={() => setMode(m)} icon={<Tile tint={tint}><Icon className="h-[17px] w-[17px]" /></Tile>} label={label} hint={hint} checked={mode === m} />
        ))}
      </Group>

      {me && (
        <Group>
          <Row onClick={() => { store.resetDemo(); toast(t.acct.resetDone); }} icon={<Tile tint="#8e8e93"><Emoji3D src="/3d/sparkles.png" size={18} /></Tile>} label={t.acct.resetDemo} chevron />
          <Row onClick={() => { signOut(); router.push("/"); }} icon={<Tile tint="#ff3b30"><LogOut className="h-[16px] w-[16px]" /></Tile>} label={t.account.signOut} danger />
          <Row
            onClick={() => { if (confirm(t.acct.deleteConfirm)) { store.deleteAccount(me.id); router.push("/"); } }}
            icon={<Tile tint="#ff3b30"><Emoji3D src="/3d/warning.png" size={18} /></Tile>}
            label={t.acct.delete}
            danger
          />
        </Group>
      )}
    </div>
  );
}

export function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section>
      {title && <div className="mb-1.5 ps-4 text-[13px] font-medium uppercase tracking-wide text-label-2">{title}</div>}
      <div className="card divide-y divide-separator overflow-hidden rounded-[22px]">{children}</div>
    </section>
  );
}

export function Tile({ tint, children }: { tint: string; children: React.ReactNode }) {
  return (
    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] text-white" style={{ background: tint }}>
      {children}
    </span>
  );
}

export function Row({
  icon,
  label,
  hint,
  onClick,
  checked,
  chevron,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  checked?: boolean;
  chevron?: boolean;
  danger?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-surface-2 active:bg-surface-3">
      {icon}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[16px]", danger && "text-urgent")}>{label}</span>
        {hint && <span className="block text-[12.5px] text-label-2">{hint}</span>}
      </span>
      {checked && <span className="text-[17px] font-semibold text-accent">✓</span>}
      {chevron && <ChevronRight className="h-4 w-4 text-label-3 rtl:rotate-180" />}
    </button>
  );
}
