# PawLink — Frontend ↔ Backend ↔ AI Handoff

> From: Frontend. Please read, reply with what you agree with or change, and **share your Swagger URL as soon as NestJS boots.**
> Frontend works on **mock data** until each endpoint is live, so nobody blocks anybody.

---

## 1. What I need from the Backend dev (NestJS)

### Setup
- [ ] **Swagger / OpenAPI** enabled (`@nestjs/swagger`) at `/docs` and `/docs-json`. I generate the typed client automatically from it.
- [ ] **CORS** allowed for `http://localhost:3000` and the Vercel domain, `credentials: true`
- [ ] **Auth:** JWT. Preferred: access token in the response body plus a refresh token in an **httpOnly cookie**. The JWT payload should include `{ sub, role, name }`.
- [ ] Consistent error format: `{ statusCode, message, code }`
- [ ] Pagination format: `{ items, total, page, pageSize }`
- [ ] **Realtime** new and updated cases: Supabase Realtime on the `cases` table **or** a Socket.IO gateway with events `case.created`, `case.updated`, `help.offered`
- [ ] A **seed script** with the wildfire demo scenario (I can provide the JSON from my mock data)

### Data shapes
```ts
type Role = "reporter" | "volunteer" | "vet" | "admin";
type Triage = "urgent" | "monitoring" | "stable";
type Species = "dog" | "cat" | "bird" | "horse" | "cow" | "sheep" | "goat" | "pig" | "rabbit" | "other";
type HelpType = "transport" | "foster" | "food" | "medical" | "search" | "boarding" | "funds";
type ServiceType = "vet" | "shelter" | "transport" | "boarding" | "training" | "store";

interface User { id: string; name: string; avatarUrl?: string; role: Role;
  helpTypes?: HelpType[]; location?: GeoPoint; rating?: number; }

interface GeoPoint { lat: number; lng: number; address?: string }

interface Case {
  id: string;
  species: Species;
  category: "companion" | "livestock";
  count?: number;                    // livestock herds
  status: "open" | "in_progress" | "resolved";
  triage: Triage;
  location: GeoPoint;
  photos: string[];                  // Cloudinary URLs
  description: string;
  conditionTags: string[];           // "bleeding", "trapped", "burned", "not eating"...
  reporter: Pick<User, "id" | "name" | "avatarUrl">;
  ai?: AIAnalysis;
  emergencyZoneId?: string;
  helpers: { user: Pick<User, "id" | "name" | "avatarUrl">; helpType: HelpType }[];
  createdAt: string; updatedAt: string;
}

interface EmergencyZone {
  id: string; name: string; type: "wildfire" | "flood" | "earthquake" | "other";
  polygon: GeoJSON.Polygon; active: boolean; startedAt: string;
  stats: { cases: number; urgent: number; helpers: number };
}

interface Service {
  id: string; type: ServiceType; name: string; location: GeoPoint;
  phone?: string; openNow?: boolean; rating: number; reviewCount: number; photos: string[];
}

interface Review { id: string; serviceId: string; author: Pick<User,"id"|"name"|"avatarUrl">;
  rating: 1|2|3|4|5; text: string; createdAt: string; }

interface AdoptionProfile {
  id: string; name: string; species: Species; breed?: string; sex: "male" | "female";
  ageMonths: number; photos: string[]; healthStatus: string;
  vaccinations: { name: string; date: string }[];
  medicalHistory: { date: string; note: string }[];
  behavior: string[];                // "good with kids", "shy"...
  careNeeds: string[]; shelter: Pick<Service, "id" | "name">; location: GeoPoint;
}
```

### Endpoints
| Method | Route | Notes |
|---|---|---|
| POST | `/auth/register` · `/auth/login` · `/auth/refresh` · `/auth/logout` | |
| GET | `/me` · PATCH `/me` | includes `helpTypes` |
| GET | `/cases?bbox=minLng,minLat,maxLng,maxLat&triage=&species=&zoneId=` | **PostGIS bbox query**, used by the map |
| GET | `/cases/nearby?lat=&lng=&radiusKm=` | dashboards |
| GET | `/cases/:id` | |
| POST | `/cases` | create (photos are already uploaded to Cloudinary, send URLs). The response includes `ai`. |
| PATCH | `/cases/:id/status` | volunteer / vet / admin |
| POST | `/cases/:id/help` | `{ helpType, message? }` |
| POST | `/uploads/signature` | Cloudinary signed upload params |
| GET | `/emergency-zones?active=true` · POST (admin) | |
| GET | `/services?lat=&lng=&type=&radiusKm=` · GET `/services/:id` | |
| GET/POST | `/services/:id/reviews` | |
| GET | `/adoptions` · `/adoptions/:id` | |
| GET | `/admin/stats` · `/admin/users` · PATCH `/admin/users/:id/role` | |

---

## 2. What I need from the AI / LLM dev (Gemini Flash) — this is a standalone service in `apps/Ai/`

> **Scope note:** the AI service is a **separate app** (`apps/Ai/`), owned by the AI
> developer. The backend does **not** implement `POST /ai/analyze` and has **no
> dependency** on the AI service until it is delivered. The frontend calls the
> backend; how the AI analysis reaches the product (a future `POST /ai/analyze`
> on the AI service, or a backend→AI link wired in later) is decided once that
> service exists. Until then `animalDetected` is `null` and `Case.ai` is absent.

### Rules (from the stack)
- The frontend **never calls Gemini directly**. The Gemini key stays server-side inside the AI service.
- Provider interface: switching provider is a config change, transparent to consumers
- **Safety rules layer:** keywords (`bleeding`, `fire`, `trapped`, `not breathing`, `saignement`, `feu`, `coincé`…) force `urgent`. Set `forcedUrgentByRule: true` so the UI can show "Flagged urgent by safety rule".
- **No diagnosis**, always point to a vet, and the `disclaimer` field is always present

### Request / response
```ts
// The AI service's analyze endpoint (in apps/Ai/), shape mirrored from the web types
interface AIAnalyzeRequest {
  photoUrls: string[];
  description: string;
  species?: Species;
  conditionTags?: string[];
  location: GeoPoint;
  lang: "fr" | "en" | "ar";
}

interface AIAnalysis {
  triage: Triage;
  confidence: number;                 // 0..1, shown as a subtle bar
  summary: string;                    // 1–2 sentences, plain language
  observedSigns: string[];            // "visible wound on left leg"
  safetyAdvice: string[];             // "keep distance", "separate bowls", "do not give human medication"
  possiblyContagious: boolean;
  contagionAdvice?: string[];         // isolate, avoid shared food/water, wash hands
  recommendedHelp: HelpType[];        // what kind of help this case needs
  suggestedServices: { serviceId: string; type: ServiceType; name: string; distanceKm: number }[];
  forcedUrgentByRule: boolean;
  disclaimer: string;                 // "PawLink AI does not diagnose. Please contact a veterinarian."
  model: string;                      // "gemini-flash", for display / debug
}
```

### Nice-to-have for the wow effect
- **Streaming** (SSE) of the analysis so the UI can reveal fields progressively. If that's not possible, a normal response is fine and the frontend fakes the stagger.
- Response time under 5s. Please give me 3 **cached example responses** (urgent, monitoring, stable) for the demo fallback.

---

## 3. Shared conventions
- Dates in ISO 8601 UTC · distances in km · coordinates as `{ lat, lng }` (GeoJSON `[lng, lat]` only inside `polygon`)
- Environments: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_USE_MOCK`, Cloudinary cloud name
- One GitHub repo (monorepo `web/`, `mobile/`, `backend/`) or separate repos. **Decide today.**
- A daily 10-minute sync: what's live, what's blocked

---

## 4. Accounts, admin & anti-abuse (the frontend screens exist, the backend must enforce)

**Accounts**
- `POST /auth/register` `{ name, email, phone, role: "reporter" | "volunteer" | "vet" }` → sends an SMS code. Then `POST /auth/verify-phone { code }`.
- **Admin is never a sign-up option.** Admins are created by a seed/CLI only. `/admin/*` endpoints check `role === "admin"` in the JWT; the frontend hides the admin page (404) for everyone else.
- A "vet" sign-up stays `reporter` until an admin checks the license (`licenseVerified`).

**Every report is checked (server-side, never trust the client):**
| Check | How |
|---|---|
| Verified account | phone OTP done |
| Inside Algeria | point inside the Algeria polygon (PostGIS `ST_Within`) |
| Photo GPS vs pin | read EXIF on the server before Cloudinary strips it; distance < 2 km |
| Photo is recent | EXIF `DateTimeOriginal` < 48 h |
| Reporter near animal | device GPS sent with the report (optional, remote reports allowed) |
| An animal is in the photo | `null` for now — the AI service (`apps/Ai/`) is not delivered yet; becomes the AI's `animalDetected` once wired in |
| Not a reused photo | perceptual hash (pHash) compared to existing cases |
| Rate limit | max 5 reports/hour/account (and per IP) |

Return `trust: { level: "verified" | "unverified" | "suspicious", score, checks[], confirmations, flags }` on each case.
`suspicious` → `moderation: "pending"`: **not shown on the public map** until an admin approves it.

**Community**
- `POST /cases/:id/confirm` ("I see it too") raises trust. `POST /cases/:id/flag`: 3 flags send the case back to moderation.
- `PATCH /admin/cases/:id/moderation { decision: "approved" | "hidden" }`
- `POST /services/:id/reviews` needs an account (1 review per user per service).

---

## 5. Adoption marketplace (screens done on the web)

Flow: owner posts (max **3 real photos**) → **admin approves** → public listing → adopter sends a request (message, housing, experience) → owner **accepts/declines** → only if accepted, both phone numbers are revealed (call / WhatsApp). PawLink never handles money.

| Method | Route | Notes |
|---|---|---|
| POST | `/adoptions` | `status: "pending"`. Max 3 photos. Reject images without camera EXIF (Make/Model/DateTimeOriginal) + pHash duplicate check (the AI "real photo of an animal?" check is part of the `apps/Ai/` service, added later) |
| GET | `/adoptions?status=approved` | public list (auth required) |
| PATCH | `/admin/adoptions/:id` | `{ status: "approved" \| "rejected" }`, admin only |
| POST | `/adoptions/:id/requests` | one request per user per listing |
| GET | `/me/adoptions`, `/me/requests`, `/me/requests/received` | dashboard |
| PATCH | `/requests/:id` | owner only, `{ status: "accepted" \| "declined" }`. The response includes the other person's phone only when accepted |

Types: `AdoptionProfile`, `AdoptionRequest` in `web/lib/types.ts`.

**Login is required for everything except the landing page.**

---

## 6. Who does what (to finish PawLink)

### Backend (NestJS, Node 22)
- [ ] Project + Swagger (`/docs`), CORS, error format
- [ ] Auth: register → SMS OTP → JWT (+refresh cookie); roles reporter / volunteer / vet / admin; admin only by seed
- [ ] Cases: CRUD, bbox query (PostGIS), help offers, confirm/flag, moderation
- [ ] Trust checks for every report (section 4) + rate limits
- [ ] Adoption marketplace (section 5)
- [ ] Services + reviews (1 per user per service)
- [ ] Emergency zones (admin draws a polygon)
- [ ] Realtime `case.created` / `case.updated` (Supabase Realtime or Socket.IO)
- [ ] Cloudinary signed upload (`POST /uploads/signature`), keep EXIF check server-side
- [ ] Seed script with the demo scenario (copy `web/lib/mock/data.ts`)

### Database (Supabase: PostgreSQL + PostGIS)
- [ ] Tables: users, cases (geography point), case_helpers, trust_checks, emergency_zones (polygon), services, reviews, adoptions, adoption_requests
- [ ] Indexes: GIST on locations; RLS off if only NestJS talks to the DB
- [ ] Algeria polygon table for the "inside Algeria" check

### AI (Gemini Flash) — standalone service in `apps/Ai/`
- [ ] `AIProvider` interface + `GeminiProvider`, provider chosen by env config
- [ ] Prompt → strict JSON matching `AIAnalysis` (+ `animalDetected`, `isRealPhoto`)
- [ ] Safety rules layer (keywords FR / AR / Darija / EN force "urgent"), list in `web/lib/ai/analyze.ts`
- [ ] Always a vet disclaimer, never a diagnosis
- [ ] 3 cached example answers for the demo fallback
- [ ] **Integration (deferred until this service is delivered):** wire the AI answer into `Case.ai` and the `animalDetected` trust check. The backend currently has **no** dependency on `apps/Ai/` by explicit decision.

### Mobile (Expo)
- [ ] Report flow with camera (EXIF kept), GPS, offline queue, push notifications ("urgent case near you", "request accepted")
- [ ] Reuse colors/logo from `brand/` and the types from `web/lib/types.ts`

### Web (done: see `web/README.md`)
- [ ] Swap the mock store/auth for API calls once the endpoints above exist
- [ ] Deploy on Vercel
