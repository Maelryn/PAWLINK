/* Design tokens — ported 1:1 from web/app/globals.css so the app matches the website. */

export const light = {
  bg: "#F5F5F7",
  bgElevated: "#FBFBFD",
  surface: "#FFFFFF",
  surface2: "#F2F2F7",
  surface3: "#E8E8ED",
  label: "#1D1D1F",
  label2: "#6E6E73",
  label3: "#AEAEB2",
  separator: "rgba(60,60,67,0.12)",
  accent: "#0A7CFF",
  accent2: "#5E5CE6",
  accentSoft: "rgba(10,124,255,0.12)",
  urgent: "#FF3B30",
  urgentSoft: "rgba(255,59,48,0.12)",
  monitor: "#FF9500",
  monitorSoft: "rgba(255,149,0,0.14)",
  stable: "#34C759",
  stableSoft: "rgba(52,199,89,0.14)",
  emergencyA: "#FF2D55",
  emergencyB: "#FF9500",
  glass: "rgba(255,255,255,0.58)",
  glassStrong: "rgba(255,255,255,0.78)",
};

export const dark: typeof light = {
  bg: "#000000",
  bgElevated: "#0B0B0D",
  surface: "#1C1C1E",
  surface2: "#2C2C2E",
  surface3: "#3A3A3C",
  label: "#F5F5F7",
  label2: "#98989D",
  label3: "#636366",
  separator: "rgba(84,84,88,0.55)",
  accent: "#0A84FF",
  accent2: "#7D7AFF",
  accentSoft: "rgba(10,132,255,0.2)",
  urgent: "#FF453A",
  urgentSoft: "rgba(255,69,58,0.2)",
  monitor: "#FF9F0A",
  monitorSoft: "rgba(255,159,10,0.2)",
  stable: "#30D158",
  stableSoft: "rgba(48,209,88,0.2)",
  emergencyA: "#FF2D55",
  emergencyB: "#FF9500",
  glass: "rgba(38,38,42,0.55)",
  glassStrong: "rgba(38,38,42,0.8)",
};

export const radius = { input: 12, button: 16, card: 24, sheet: 32 };

export const shadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.08,
  shadowRadius: 32,
  elevation: 6,
};

/* Same rule as the website: dark from 19:00 to 07:00 when set to "auto". */
export const NIGHT_START = 19;
export const NIGHT_END = 7;
export function resolveTheme(mode: "auto" | "light" | "dark", date = new Date()) {
  if (mode !== "auto") return mode;
  const h = date.getHours();
  return h >= NIGHT_START || h < NIGHT_END ? ("dark" as const) : ("light" as const);
}
