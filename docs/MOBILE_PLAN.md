# PawLink — Mobile Plan (Expo / React Native)

Companion docs:
- [docs/FRONTEND_PLAN.md](FRONTEND_PLAN.md): the web reference we mirror 1:1 graphically
- [docs/BRAND_AND_ASSETS.md](BRAND_AND_ASSETS.md): logo, 3D animal art, fonts, asset sources
- [docs/TEAM_HANDOFF.md](TEAM_HANDOFF.md): backend + AI contract (same API the mobile app will consume)

> Goal: the mobile app must feel like the **same product** as the website — same tokens, same glass, same triage colors — built once in `apps/mobile/` with the most stable Expo stack, frontend only (mock-first like `apps/web/`).

---

## 0. Status (Oct 2, 2026)

| Done | What |
|---|---|
| ✅ | Plan + docs (this file) |
| ⏳ | Expo SDK 57 scaffold in `apps/mobile/` (Expo Go, expo-router) |
| ⏳ | Port design tokens (`lib/theme.ts` mirrors `apps/web/app/globals.css`) |
| ⏳ | Screens: map home, report flow, case detail, adoption, services, dashboard, profile/login |
| ⏳ | Camera (EXIF GPS), push notifications, offline mode |
| ⏳ | Plug NestJS API when backend (`apps/backend/`) is live |

---

## 1. Stack (fixed — do not deviate)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Expo SDK 57 + React Native**, tested in **Expo Go** | user constraint, most stable |
| Navigation | **expo-router** (file-based, mirrors web routes) | same mental model as `apps/web/app` |
| Styling | StyleSheet + shared tokens (`lib/theme.ts`), `expo-blur` for glass | no NativeWind fragility, pixel-parity with web |
| Map | **react-native-maps** (Apple/Google provider) + OpenStreetMap tiles optional via `UrlTile` | ships in Expo Go, most stable |
| Camera | **expo-image-picker** / **expo-camera** + `exifr` for GPS EXIF | same EXIF trick as web |
| Location | **expo-location** | permissions + geocoding |
| Push | **expo-notifications** | local + remote, demo-ready |
| Animations | **react-native-reanimated** + `moti` where useful | replaces `motion` on web |
| Offline | **AsyncStorage** cache of cases/services + queue for reports | "mode hors ligne" |
| Data | mock-first in `lib/mock/` + `lib/store.ts`, same contract as web | backend later |

---

## 2. Design system — copy of the website

Port these values verbatim into `apps/mobile/lib/theme.ts` (source: `apps/web/app/globals.css`):

| Token | Light | Dark |
|---|---|---|
| `bg` | `#F5F5F7` | `#000000` |
| `surface` | `#FFFFFF` | `#1C1C1E` |
| `surface-2` | `#F2F2F7` | `#2C2C2E` |
| `label` / `label-2` | `#1D1D1F` / `#6E6E73` | `#F5F5F7` / `#98989D` |
| `accent` | `#0A7CFF` | `#0A84FF` |
| `urgent` / `monitor` / `stable` | `#FF3B30` / `#FF9500` / `#34C759` | `#FF453A` / `#FF9F0A` / `#30D158` |
| emergency gradient | `#FF2D55 → #FF9500` | same |
| glass | `rgba(255,255,255,0.58)` + `BlurView` | `rgba(38,38,42,0.55)` |

- **Radius:** 12 inputs · 16 buttons · 24 cards · 32 sheets/pins
- **Shadow:** `0 2px 4px rgba(0,0,0,.04), 0 12px 32px rgba(0,0,0,.08)`
- **Type:** system font (SF on iOS, Roboto on Android), tight tracking, big titles
- **Theme auto:** dark from 19:00 to 07:00 (same rule as web `lib/theme.tsx`)
- **i18n:** reuse the same three dictionaries FR / AR (RTL) / EN from `apps/web/lib/i18n/`

## 3. Routes (expo-router) — same URLs as web

| Route | What |
|---|---|
| `app/index.tsx` | Landing/onboarding (hero + CTA to map) |
| `app/map.tsx` | Live map: photo pins, clustering, filters, emergency mode |
| `app/report.tsx` | 4-step report flow → AI triage reveal |
| `app/cases/[id].tsx` | Case detail, AI card, timeline, "I can help" |
| `app/adopt/index.tsx`, `app/adopt/[id].tsx` | Adoption cards + profiles |
| `app/services.tsx` | Vets, shelters, transport with ratings |
| `app/dashboard.tsx` | Reporter / volunteer / vet views |
| `app/login.tsx` | Mock login (same accounts as web: `*@pawlink.dz` / `pawlink2026`) |

## 4. Field features (mobile-only superpowers)

- **Camera + EXIF:** photo GPS/timestamp extracted with `exifr` feeds the trust checks (same `Trust` type as web)
- **GPS:** live location for "cases near me" and auto-fill of the report location
- **Push:** local notification when a new urgent case appears nearby; remote via Expo push tokens later
- **Offline:** AsyncStorage cache; reports queued and synced when back online

## 5. Where things live (target)

```
apps/mobile/
  app/                  expo-router routes (mirrors apps/web/app)
  components/           ui (Button, TriageBadge, Chip…), brand, map, cases
  lib/
    theme.ts            port of web globals.css tokens
    types.ts            copy of apps/web/lib/types.ts (same contract)
    store.ts            AsyncStorage-backed store, same actions as web
    ai/analyze.ts       copy of web mock AI triage
    i18n/               fr.ts, ar.ts, en.ts (copied)
    mock/data.ts        same demo scenario (Kabylie wildfire)
  assets/
```

## 6. Plugging in the backend later

Identical rule as the web: replace `lib/store.ts` + `lib/ai/analyze.ts` with `POST /cases`, `GET /cases?bbox=`; keep `EXPO_PUBLIC_USE_MOCK=true` for offline demos. Backend lives in `apps/backend/` (NestJS). The AI analysis (`POST /ai/analyze`) is a separate service in `apps/Ai/` — not on the backend until that service is delivered.
