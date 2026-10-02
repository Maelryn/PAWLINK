# PawLink — Frontend Master Plan (Demo Day)

Companion docs:
- [docs/BRAND_AND_ASSETS.md](BRAND_AND_ASSETS.md): logo, 3D animal art, AI prompts, fonts, asset sources, licenses
- [docs/TEAM_HANDOFF.md](TEAM_HANDOFF.md): send this to the backend dev and the AI/LLM dev

---

## ✅ Status (Oct 1, 2026): built and running in `web/`

| Done | What |
|---|---|
| ✅ | Design system: liquid-glass tokens, light/dark, FR / AR (RTL) / EN, coded SVG logo + favicon |
| ✅ | Landing: iOS 16-style hero with floating 3D animals and parallax, scroll-tilted live 3D map, bento features, counters, CTA |
| ✅ | Live map: Apple-Maps-style recolor of OpenStreetMap (free, no key), 3D buildings, photo pins, clusters, filters, search, side panel (desktop) / carousel + sheet (mobile) |
| ✅ | Emergency mode: Kabylie wildfire zone, pulsing fire glow, cinematic 3D fly-in + orbit, banner with Civil Protection (14) |
| ✅ | Report flow (4 steps) → AI "analyzing" scan → triage reveal (color flood) → new pin drops on the map |
| ✅ | Mock AI with safety-rule layer ("forced urgent"), contagion advice, nearest services, vet disclaimer |
| ✅ | Case detail, "I can help", adoption list + profiles, services + reviews, dashboards (3 roles), admin (charts, moderation, zones, users) |
| ⏳ | Plug in the NestJS API + realtime (see `web/README.md`) |
| ⏳ | Swap in the generated logo renders + custom 3D cast (prompts in `docs/BRAND_AND_ASSETS.md`) |
| ⏳ | Deploy to Vercel, rehearse the demo on the projector |

> Map decision changed: we use **MapLibre + OpenFreeMap** (open-source, free, no token, OSM data), restyled to look like Apple Maps. A Mapbox token is no longer needed.

---

## 0. The vision in one sentence

> **PawLink should feel like an Apple product page that turned into a working app.**
> Soft white space, floating 3D animal characters, frosted glass, a 3D map that flies, and an AI moment that feels like magic.

Moodboard (from the references you sent):
| Reference | What we take from it |
|---|---|
| iOS 16 page (floating Animoji around a glass "16" tile) | **Landing hero**: the PawLink icon in the center as a glass tile, with 3D animal heads floating around it in depth-of-field blur and parallax on mouse move |
| Social app with photo pins on map | **Map pins = rounded photo bubbles** of the animal, with a triage-colored ring and a small 3D species badge |
| Travel app (cards and map carousel) | **Map bottom carousel**: swipeable case cards synced with the map (swipe a card, the map flies to that pin) |
| Green "AI sidekick" slides | **Pitch/marketing slides** for demo day, plus how to present the AI feature ("Ask PawLink AI") |

---

## 1. Is there really an admin? Yes.

The stack doc says: *"WEB: Carte publique, tableaux de bord, **admin**"* and roles *reporter, bénévole, vétérinaire, admin*.
So the web has **4 areas**:

| Area | Who | What |
|---|---|---|
| **Public** | everyone, no login | landing, live map, adoption, services directory |
| **Dashboard** | reporter / volunteer / vet | my cases, cases near me, "how I can help", accept a case |
| **Admin** | admin | moderate cases, manage users and roles, create **emergency zones** (wildfire, flood), stats |
| **Auth** | — | login and register with role choice |

---

## 2. Design system

### Feel
- **Background:** `#F5F5F7` with very soft colored "blobs" (blurred radial gradients) behind content, like the iOS 16 page
- **Glass everywhere:** nav, search bar, map overlays, sheets (`backdrop-blur-2xl saturate-150`, white at 60–70%)
- **3D animal characters** instead of icons in empty states, onboarding, species pickers and the hero (see BRAND doc)
- **Big, tight typography:** 56–80px hero, `-0.03em` tracking, semibold
- **Dark mode** that looks premium: true black, with glass tinted dark

### Tokens
| Token | Light | Dark |
|---|---|---|
| `bg` | `#F5F5F7` | `#000000` |
| `surface` | `#FFFFFF` | `#1C1C1E` |
| `surface-2` | `#F2F2F7` | `#2C2C2E` |
| `label` / `label-2` | `#1D1D1F` / `#6E6E73` | `#F5F5F7` / `#98989D` |
| `accent` (brand) | `#0A84FF`, to be finalized with the logo | — |
| `urgent` / `monitor` / `stable` | `#FF3B30` / `#FF9500` / `#34C759` | `#FF453A` / `#FF9F0A` / `#30D158` |
| `emergency` gradient | `#FF2D55 → #FF9500` | same |

- **Radius:** 12 inputs · 16 buttons · 24 cards · 32 sheets and photo pins (squircle feel)
- **Shadow:** `0 2px 4px rgba(0,0,0,.04), 0 12px 32px rgba(0,0,0,.08)`
- **Font:** the system stack (`-apple-system, BlinkMacSystemFont, "SF Pro Display"`), so Apple devices get SF Pro, and **Inter** as the fallback. This is the legal way; see the BRAND doc for why we can't self-host SF Pro.
- **Icons:** Lucide (stroke 1.75) for UI. 3D Fluent Emoji for species and illustrations.

### Motion: "insane but smooth"
| Library | Used for |
|---|---|
| **Framer Motion** (`motion`) | springs, layout animations, shared-element transitions (card → detail), sheets, stagger |
| **Lenis** | buttery smooth scroll on the landing page |
| **GSAP + ScrollTrigger** | scroll-driven hero sequences (pinned sections and scrubbing, like Apple product pages) |
| **Lottie / Rive** | small animated moments: success check, AI "thinking" paw, loading |
| **Mapbox GL camera** | `flyTo` with pitch and bearing, which is cinematic |

Motion rules:
- Springs only: `{ type: "spring", stiffness: 380, damping: 30 }` for UI and softer `{ stiffness: 120, damping: 20 }` for floating characters
- Every pressable item scales to 0.97 when pressed. Cards lift on hover (`y: -4`, bigger shadow).
- Use **shared-element transitions** with `layoutId`: the case card photo morphs into the detail header
- Floating 3D animals bob gently (6–10px, 4–6s loops, randomized delays) and parallax with the mouse
- Respect `prefers-reduced-motion`. Must hold **60fps**: animate only `transform`/`opacity`.

---

## 3. The "Apple Maps" map

**Recommendation: Mapbox GL JS v3 with the `Standard` style.** It is already allowed in the stack ("ou Mapbox GL").
- 3D buildings, terrain, soft lighting, landmark models: the closest thing to Apple Maps on the web
- `lightPreset`: `day` for light mode, `night` for dark mode, and **`dusk` for Emergency mode** (dramatic)
- Free tier: 50k map loads per month, which is plenty for the demo
- Fallback if there's no token: **MapLibre GL + OpenFreeMap** (free, no key, OSM data) with a custom light style

Map features:
1. **Photo-bubble pins:** an HTML marker with a rounded photo, a triage-colored ring, and a pulse halo for urgent. A small 3D emoji badge shows the species.
2. **Clustering:** custom cluster bubbles show the count, with a mini stack of 3 photos, and a color mix based on the worst triage inside
3. **Bottom card carousel** (from the travel reference): swiping a card flies the map to that pin and selecting a pin scrolls the carousel
4. **Glass search bar** on top and filter chips (Species · Triage · Type · "Need transport", and so on)
5. **Emergency mode:**
   - switches to the `dusk` light preset, with a red banner sliding down: "🔥 Wildfire: Zone X · 23 animals · 9 urgent · 14 helpers"
   - zone polygon with an animated **glowing, pulsing red fill** and a fire-spread heatmap layer
   - camera does a slow cinematic `flyTo` (pitch 60°, rotating bearing)
   - only urgent and monitoring cases shown, sorted by distance
6. **Live new pin:** when a report is submitted, the pin **drops in** with a bounce and a ripple
7. **Nearby services layer** (vets, shelters, transport) as small glass icons and toggles

---

## 4. Pages and features, by priority

### P0: the demo path (must be flawless)
| Page | The "wow" |
|---|---|
| **Landing** `/` | iOS 16-style hero: glass PawLink icon, floating 3D animals with blur and parallax, gradient headline. Scroll leads to a pinned section where the map tilts into 3D, then feature sections (Report, AI triage, Emergency, Adopt) with scroll animations, live stats counters and a CTA. |
| **Live map** `/map` | Everything in section 3 |
| **Report flow** `/report` | Glass sheet, 4 steps with an animated progress pill: ① Photo (drag and drop, Cloudinary upload progress ring) ② Location (mini-map, auto GPS, draggable pin) ③ Species and condition (3D emoji species picker, condition chips) ④ Review → **AI reveal** |
| **AI triage reveal** | "PawLink AI is analyzing…" shows a shimmer and an animated paw. Then the triage badge springs in with a color flood, followed by a staggered summary, observed signs, safety tips, contagion warning and suggested nearby services. A permanent footer says *"Not a diagnosis, contact a vet."* |
| **Case detail** `/cases/[id]` | Shared-element photo, status timeline, AI card, mini-map, nearby services, a big **"I can help"** button that opens the help type sheet |

### P1
| Page | Notes |
|---|---|
| **Dashboards** `/dashboard` | role-based: *Reporter* (my reports), *Volunteer* (nearby cases, my skills: transport, foster, food, medical), *Vet* (urgent queue) |
| **Services** `/services` | vets, shelters, transport, boarding, training, stores. List and map, star ratings, reviews. |
| **Adoption** `/adopt` + `/adopt/[id]` | App Store "Today" style big cards. Profile with age, vaccines (checklist), medical history timeline, behavior tags, care needs. |
| **Auth** | glass card, role picker with 3D characters |

### P2
| Page | Notes |
|---|---|
| **Admin** `/admin` | sidebar layout (like macOS), case moderation table, users and roles, **emergency zone drawing on the map**, stats charts |
| Reviews | submit a rating and review |
| Livestock fields | herd size, farm contact |
| i18n | FR / EN / AR (RTL) |

---

## 5. Tech setup

```
Next.js 15 (App Router) + TypeScript + Tailwind v4
UI: shadcn/ui (Radix) restyled · motion · lenis · gsap · lottie-react
Map: mapbox-gl v3 (react-map-gl) · fallback maplibre-gl
Data: @tanstack/react-query · API client generated from the backend's Swagger (orval)
Forms: react-hook-form + zod · Toasts: sonner · Sheets: vaul · Theme: next-themes
Realtime: Supabase Realtime or Socket.IO from NestJS (new cases appear live)
```

```
pawlinkapp/
  web/                 Next.js app
    app/(public) (auth) (dashboard) admin/
    components/ui/          design system
    components/motion/      FloatingAnimal, Reveal, Parallax, PressScale…
    components/map/         Map, PhotoPin, Cluster, EmergencyLayer, CardCarousel
    components/features/    report, ai, cases, adoption, services
    lib/api/  lib/mock/  lib/ai/
    public/3d/ public/brand/ public/lottie/
  docs/
```

**Mock mode:** `NEXT_PUBLIC_USE_MOCK=true` makes the app run 100% without the backend. This is required for the demo.

---

## 6. Step-by-step: what to do, in order

### Phase A: Brand and assets (Day 1, can be done in parallel by anyone)
- [ ] Generate the **app icon / logo** using the prompts in the BRAND doc, and pick the best one
- [ ] Download **Microsoft Fluent Emoji 3D** animals (free, MIT); this gives 3D animal art today
- [ ] Optional: generate **custom 3D PawLink mascots** with the prompts, then remove backgrounds
- [ ] Get a free **Mapbox token**
- [ ] Download the **Apple Design Resources** iOS Figma kit, for mockups and pitch slides only

### Phase B: Foundation (Day 1–2)
- [ ] Create a Git repo on GitHub (the project isn't versioned yet) and invite the team
- [ ] Scaffold Next.js, Tailwind tokens, fonts, dark mode, Lenis
- [ ] Motion primitives: `PressScale`, `Reveal`, `Stagger`, `FloatingAnimal`, `Parallax`
- [ ] UI kit: Button, GlassPanel, Sheet, SegmentedControl, TriageBadge, Chip, Card, Skeleton, Toast
- [ ] Mock data: wildfire scenario (25 cases, volunteers, vets, shelters, adoption animals)
- [ ] **Send TEAM_HANDOFF.md to the backend and AI devs**

### Phase C: The wow screens (Day 3–6)
- [ ] Map: Mapbox Standard, photo pins, clusters, carousel, filters
- [ ] Emergency mode
- [ ] Report flow and AI reveal
- [ ] Case detail with shared-element transition

### Phase D: Landing (Day 7)
- [ ] iOS 16 hero, scroll story, stats, CTA

### Phase E: The rest (Day 8–9)
- [ ] Dashboards, services, adoption, auth, admin

### Phase F: Integration and polish (Day 10+)
- [ ] Swap mock for the real API endpoint by endpoint (keep mock as a fallback)
- [ ] Realtime new cases
- [ ] Responsive (the jury will open it on phones), accessibility, Lighthouse ≥ 90
- [ ] Deploy on **Vercel**, then rehearse the demo 3 times on the projector

---

## 7. Demo script (3 min)
1. **Landing:** animals float in, the headline lands. Scroll once and the map tilts into 3D.
2. **"Open live map":** cinematic flyTo into the city, photo pins everywhere
3. **Toggle Emergency:** dusk lighting, a red zone pulses, the banner drops: "🔥 Wildfire"
4. **Report:** upload a photo of an injured goat, GPS pin, species picker
5. **AI reveal:** **URGENT** floods red, safety tips appear, "Nearest vet 2.3 km · 3 volunteers with transport"
6. **Back to the map:** the new pin drops live, and a volunteer toast says "Yassine can transport · 6 min"
7. **Adoption:** one beautiful profile card, then end on the logo

Backup: a screen recording of the full demo plus mock mode on localhost.

---

## 8. "Exceptional" checklist
- [ ] 60fps everywhere, no layout jumps
- [ ] Skeletons and shimmer, never a blank screen
- [ ] Every pressable item has press feedback, every sheet springs, every list staggers
- [ ] Dark mode is flawless (map included)
- [ ] The AI reveal makes people say "wow"
- [ ] The vet disclaimer is always visible
- [ ] Phone-perfect responsive layout
- [ ] Favicon, OG image and app icon all match the brand
- [ ] Works offline in mock mode
