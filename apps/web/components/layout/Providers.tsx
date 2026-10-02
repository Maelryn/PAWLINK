"use client";

import { Toaster } from "sonner";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { ThemeSync, useTheme } from "@/lib/theme";
import { AuthGate } from "./AuthGate";

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
  return (
    <I18nProvider>
      <ThemeSync />
      <AuthGate>{children}</AuthGate>
      <ThemedToaster />
    </I18nProvider>
  );
}
