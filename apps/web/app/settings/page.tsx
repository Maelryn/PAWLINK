"use client";

import { SettingsPanel } from "@/components/account/SettingsPanel";
import { TopNav } from "@/components/layout/TopNav";
import { useI18n } from "@/lib/i18n";

export default function SettingsPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-[100svh] pb-32">
      <TopNav />
      <div className="mx-auto max-w-[620px] px-4 pt-[76px] sm:pt-24">
        <h1 className="mb-6 text-[34px] font-extrabold">{t.acct.tabs.settings}</h1>
        <SettingsPanel />
      </div>
    </div>
  );
}
