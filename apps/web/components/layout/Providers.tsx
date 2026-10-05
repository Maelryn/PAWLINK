"use client";

import { Toaster } from "sonner";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { ThemeSync, useTheme } from "@/lib/theme";
import { AuthGate } from "./AuthGate";
import { ProHost } from "@/components/pro/ProHost";
import { Aurora } from "@/components/ui/Aurora";
import { useEffect } from "react";
import { store } from "@/lib/store";

function ThemedToaster() {
  const { resolved } = useTheme();
  const { dir } = useI18n();
  return (
    <Toaster
      position="top-center"
      dir={dir}
      theme={resolved}
      toastOptions={{
        style: {
          background: "var(--glass-bg-strong)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          border: "1px solid var(--glass-border)",
          borderRadius: 22,
          color: "var(--label)",
          boxShadow: "var(--glass-shadow)",
          fontFamily: "inherit",
        },
      }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => store.hydrate(), []);
  return (
    <I18nProvider>
      <ThemeSync />
      {/* living background behind every page */}
      <div className="pointer-events-none fixed inset-0 -z-10 dark:opacity-60"><Aurora intensity={0.35} /></div>
      <AuthGate>{children}</AuthGate>
      <ProHost />
      <ThemedToaster />
    </I18nProvider>
  );
}
