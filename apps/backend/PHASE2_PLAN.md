# PawLink Backend — Phase 2 plan (Cases + trust + AI + realtime)

> Working document for the next phase on `apps/backend/`. Scope fixed by
> `../docs/BACKEND_PROMPT.md` §7 *Phase 2 — Cases + trust + AI + realtime (the core)*.
> Phase 0 + Phase 1 are committed and Phase 1 is proven against a real PostgreSQL+PostGIS
> database. This file changes no contract — it only sequences the work.

**Phase 2 in one line:** `POST /cases` runs a report through the **trust pipeline** (EXIF, pHash,
Algeria polygon, rate limit) and the **AI triage** (provider + safety-rule override + 3 cached
fallbacks), stores the result, and broadcasts `case.created` — while `GET /cases?bbox=…` answers the
map with one PostGIS query.

---

## 1. Scope

### In scope

| Area | Deliverable |
|---|---|
| Cases | `GET /cases` (bbox + filters + moderation gating), `GET /cases/nearby`, `GET /cases/:id`, `POST /cases`, `PATCH /cases/:id/status` |
| Community | `POST /cases/:id/help` (emits `help.offered`), `POST /cases/:id/confirm`, `POST /cases/:id/flag` |
| Moderation | `PATCH /admin/cases/:id/moderation` + `GET /admin/cases` (admin guard) |
| Uploads | `POST /uploads/signature` (Cloudinary) and `POST /uploads/probe` (EXIF + dHash, server-side truth) |
| Trust | the 8 checks from `apps/web/lib/trust.ts`, re-implemented server-side, **never trusting client input** |
| AI | `POST /ai/analyze`, `AIProvider` interface + `MockProvider` + `GeminiProvider`, safety-rule layer, 3 cached fallbacks, `< 5 s` timeout |
| Realtime | Socket.IO gateway emitting `case.created`, `case.updated`, `help.offered`, `notification` |
| Serialization | `caseRowToCase()`, the single row → `Case` mapper (mirrors Phase 1's `userRowToUser`) |

### Out of scope (and where it lands)

| Deferred | Lands in |
|---|---|
| `/admin/stats`, users/roles, adoption/services moderation queues | Phase 4 |
| Adoptions, services, reviews, bookings, zones CRUD, notifications CRUD | Phase 3 |
| `GET /me/adoptions`, `/me/notifications` | Phase 3 |
| AI streaming (SSE) | optional — the handoff marks it "nice-to-have"; the frontend fakes the stagger already |
| `animalDetected` being *real* (Gemini vision) | arrives with `GeminiProvider`; the mock provider answers per §7.3 |

---

## 2. Contracts that must hold

1. **Every trust check is server-side.** A client-supplied `trust` object in the POST body is
   ignored (and stripped by the whitelist pipe).
2. **`GET /cases` only returns public rows** — `moderation` null or `"approved"`. `"pending"` and
   `"hidden"` are invisible to the public map; the reporter and admins see their own.
3. **Response shapes** must match `apps/web/lib/types.ts` field-for-field: `Case`, `AIAnalysis`, `Trust`.
4. **`POST /cases` returns `ai` and `trust`** in the response body.
5. **Safety rules override the model**, and `forcedUrgentByRule: true` is propagated.
6. **No diagnosis, ever.** `disclaimer` is always present and points to a veterinarian.
7. **Bbox is one raw statement** using `location && ST_MakeEnvelope(...)` (schema already has the GIST index).
8. **Distances in km, rounded to 0.1** for suggestions; coordinates `{ lat, lng }`.
9. Everything still runs with `AI_PROVIDER=mock`, `SMS_PROVIDER=console` and no Cloudinary keys.

---

## 3. Trust pipeline (port of `apps/web/lib/trust.ts`)

The scoring, `hardFail` ids and level thresholds are copied **exactly** — the web UI already shows
them, so any drift would be visible.

```ts
score   = known.length ? passed / known.length : 0.5      // rounded to 2 decimals
hardFail = some check failed AND its id ∈ { inAlgeria, photoGps, duplicate, rateLimit }
level   = hardFail || score < 0.5        → "suspicious"
         score >= 0.85 && checks[0].ok   → "verified"
         otherwise                       → "unverified"
suspicious → moderation: "pending" (hidden from GET /cases until an admin approves)
```

| id | Web mock | Real server check (Phase 2) |
|---|---|---|
| `account` | `user.phoneVerified` | same, read from the row |
| `inAlgeria` | bbox `lat 18.9–37.2 / lng -8.7–12` | `ST_Within(ST_SetSRID(ST_MakePoint(lng,lat),4326), ST_GeomFromGeoJSON($1))` against a **simplified Algeria boundary** (see R4) |
| `photoGps` | `distanceKm(exif, pin) < 2` | same, from `exifr`-read EXIF on the probed original |
| `photoFresh` | `now - DateTimeOriginal < 48 h` | same |
| `onSite` | device GPS `< 5 km` | same, optional field |
| `animalDetected` | always true | `MockProvider` (see §7.3); `GeminiProvider` real vision |
| `duplicate` | flag | `sharp` → 64-bit dHash, Hamming ≤ 8 against `photo_hashes` |
| `rateLimit` | `recentReports < 5` | ≤ 5 reports / hour / account **and** per IP → `TRUST_RATE_LIMITED` |

Unit tests must port the web's own cases: happy path (`verified`), out-of-Algeria (`suspicious`,
hard fail), reused photo, 6th report/hour, unknown-everything (score 0.5), and the
`0.85 && account` verified threshold.

---

### 3.1 The PostGIS statements, already verified against a real database

Every query shape below was run against a throwaway PostgreSQL 17.5 + PostGIS 3.5 container loaded
with the **actual seeded schema**, so they are known to work rather than assumed:

**Bbox (one raw statement, `location &&` uses the existing GIST index):**

```sql
SELECT … FROM cases
WHERE location && ST_MakeEnvelope($1,$2,$3,$4,4326)
  AND (moderation IS NULL OR moderation = 'approved')
ORDER BY CASE triage WHEN 'urgent' THEN 0 WHEN 'monitoring' THEN 1 ELSE 2 END,
         "createdAt" DESC
```
Returned 12 cases around Tizi Ouzou and ordered urgent-first as expected.

**Algeria check (geometry, not geography — geography predicates are the fragile path):**

```sql
ST_Within(ST_SetSRID(ST_MakePoint($1,$2),4326), ST_GeomFromGeoJSON($3))
```
Tested with the bbox-derived rectangle: Algiers `true`, Paris `false`, the Kabylie wildfire centre `true`.
Note the parameter ordering: `ST_MakePoint(lng, lat)`.

**Nearest services (km, and the KNN index does the sorting):**

```sql
SELECT id, name, type, round((ST_Distance(location, $1::geography)/1000)::numeric, 1) AS km
FROM services WHERE type = 'vet' ORDER BY location <-> $1::geography LIMIT 3
```
Returned 3.4 / 5.8 / 92.5 km for the seeded urgent case — distances already in km, matching the
`distanceKm` rounding the web mock applies.

**One useful discovery:** the seed already contains **1 case with `moderation = 'pending'`** and 26
`approved`, so the public-map gating and `GET /admin/cases` are exercised by the existing demo data
without needing a hand-crafted suspicious case in the e2e.

---

## 4. Files to create

```
apps/backend/src/
├── cases/
│   ├── cases.module.ts · cases.controller.ts · cases.service.ts · cases.service.spec.ts
│   ├── trust.service.ts · trust.service.spec.ts     # the 8 checks + scoring
│   ├── serialize.ts · serialize.spec.ts              # row → Case (reporter, helpers, trust, ai)
│   ├── dto/create-case.dto.ts · patch-status.dto.ts · offer-help.dto.ts · confirm.dto.ts · flag.dto.ts
│   └── bbox.ts                                       # bbox parsing/validation (one place)
├── uploads/
│   ├── uploads.module.ts · uploads.controller.ts · uploads.service.ts
│   ├── exif.service.ts · exif.service.spec.ts         # exifr
│   ├── dhash.service.ts · dhash.service.spec.ts       # sharp + Hamming
│   └── cloudinary.ts                                  # signature params
├── ai/
│   ├── ai.module.ts · ai.controller.ts · ai.service.ts
│   ├── ai.provider.ts · mock.provider.ts · gemini.provider.ts
│   ├── templates/{fr,en,ar}.ts                           # summaries / signsMap / advice / disclaimer
│   ├── safety-rules.ts · safety-rules.spec.ts          # keyword + tag lists, forced urgent
│   └── fallbacks/{urgent,monitoring,stable}.json       # checked into the repo
├── geo/
│   ├── algeria-boundary.json                          # simplified polygon (see R4)
│   └── geo.service.ts                                  # ST_Within / ST_DWithin / ST_Distance helpers
└── realtime/
    ├── realtime.module.ts · realtime.gateway.ts · realtime.gateway.spec.ts
    └── events.ts                                       # typed emit helpers
```

`app.module.ts` gains `CasesModule`, `UploadsModule`, `AiModule`, `GeoModule`, `RealtimeModule`.

**New dependencies** — both are explicitly named in `docs/BACKEND_PROMPT.md` §3.5, so §6 rule 7 is
satisfied by citing them rather than by asking. Both were **verified installable and working on this
machine** before this plan was written:

| Package | For | Verified |
|---|---|---|
| `exifr` | `photoGps` / `photoFresh` | installs clean; `parse()` on a JPEG with no EXIF returns **`undefined`** (it does not throw and does not return `null`) — the service must treat `undefined` as "no EXIF" |
| `sharp` | dHash for `duplicate` | installs clean (prebuilt binaries); a 9×8 greyscale decode gives 72 px = 64 comparisons, exactly what a dHash needs |

---

## 5. Endpoints (Phase 2 surface)

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/cases?bbox=minLng,minLat,maxLng,maxLat&triage=&species=&category=&status=&zoneId=` | public | **PostGIS bbox**, ordered by `triage` then `createdAt DESC`; moderation-gated |
| GET | `/cases/nearby?lat=&lng=&radiusKm=` | bearer | dashboards |
| GET | `/cases/:id` | public if public, else 404 | |
| POST | `/cases` | bearer + verified phone | response **includes `ai` and `trust`** |
| PATCH | `/cases/:id/status` | volunteer / vet / admin | |
| POST | `/cases/:id/help` | bearer | emits `help.offered` |
| POST | `/cases/:id/confirm` | bearer | `trust.confirmations++`, may raise level |
| POST | `/cases/:id/flag` | bearer | 3 flags → `moderation: "pending"` |
| PATCH | `/admin/cases/:id/moderation` | admin | `{ decision: "approved" \| "hidden" }` |
| POST | `/uploads/signature` | bearer | Cloudinary signed params |
| POST | `/uploads/probe` | bearer | multipart → EXIF + dHash, returns a `probeId` |
| POST | `/ai/analyze` | bearer | `AIAnalysis` + `animalDetected` + `isRealPhoto` |

Pagination stays `{ items, total, page, pageSize }`; the bbox query is capped (default 200, max 500)
and `total` is the matching count, not the page length.

### `POST /cases` body

```ts
{
  title, species, category, count?, triage?,          // triage is a *baseline*, rules may raise it
  location: { lat, lng, address? },
  photos: string[],                                   // Cloudinary URLs, from POST /uploads/probe ids
  description, conditionTags: string[],
  device?: { lat, lng },                              // optional, for the onSite check
  emergencyZoneId?,
  reporterOnSite?: boolean,
  probeIds: string[]                                  // one per photo — see §6 EXIF problem
}
```

`trust`, `moderation`, `ai`, `reporter`, `id`, `createdAt`, `updatedAt` are **never** accepted from
the client: they are absent from the DTO, so `whitelist: true` strips them.

---

## 6. The EXIF problem (needs a decision before step 6)

`docs/BACKEND_PROMPT.md` §3.5 requires EXIF "read server-side from the original file before upload",
but §3.3 says photos "are already uploaded (Cloudinary URLs)" and Cloudinary strips metadata. Both
cannot be true at once.

| option | pros | cons |
|---|---|---|
| **A. `POST /uploads/probe`** (recommended) | keeps the direct-to-Cloudinary upload; the **server** extracts EXIF + dHash and returns an opaque `probeId`; `POST /cases` takes `probeIds`, so nothing is forgeable | needs somewhere to keep the probe result between the two calls |
| B. proxy the original through the API | simplest to trust | large bodies through our server, defeats the point of signed uploads |
| C. client-extracted EXIF | zero backend work | **violates "never trust the client"** |

Recommendation: **A**. `photo_hashes` already exists for the dHash; the EXIF result needs a small
`photo_probes` table (`id`, `userId`, `exif Json`, `createdAt`, TTL ~1 h) — **flagged** because §4's
table list does not include it, so it needs a migration and a line in `## Deviations`.
If the frontend dev confirms the probe round-trip is impossible on web/mobile, fall back to **B**.

---

## 7. AI — `POST /ai/analyze`

### 7.1 Provider interface

```ts
interface AIProvider {
  readonly name: 'mock' | 'gemini';
  analyze(input: AnalyzeInput): Promise<AiModelResult>;   // raw model answer, pre-rules
}
```
Chosen by `AI_PROVIDER` (default `mock`). Swapping providers is an env change, nothing else.

### 7.2 The safety-rule layer runs **after** the model and **overrides** it

Ported verbatim from `apps/web/lib/ai/analyze.ts`:

- `URGENT_TAGS` = `trapped, bleeding, breathing, fire, burned`
- `CONTAGIOUS_TAGS` = `eyes, sneezing, skin, itching, coughing`
- `MONITOR_TAGS` adds `injured, lost, stressed, thin, dehydrated, limping, not-eating, heat, young, abandoned`
- keyword lists in FR / EN / AR / Darija (the `saign/sang/feu/brûl/piég/…`, `bleed/blood/fire/burn/trapped/…`,
  `نزيف/دم/حريق/نار/محاصر/تنفس/…` sets) — copied as-is into `safety-rules.ts`
- a hit forces `triage: "urgent"` and sets `forcedUrgentByRule: true`; rules can only **raise** a triage

### 7.3 The mock provider

Deterministic, offline, and faster than the web's 3.2 s simulated latency (the backend should answer
in well under the 5 s budget). It ported `analyze()` minus the I18n: the backend must return the
**same shape**, but text templates move server-side into `src/ai/templates/{fr,en,ar}.ts` — the
`summaries`, `signsMap`, `advice`, `disclaimer` blocks from `apps/web/lib/i18n/{en,fr,ar}.ts`, keyed
by the request's `lang`.

`animalDetected`: `true` when a photo was sent, `null` when none. It becomes the `animalDetected`
trust check value.

### 7.4 The Gemini provider

- Key stays server-side (`GEMINI_API_KEY`), the frontend never calls it.
- `responseMimeType: "application/json"`, strict prompt, **validated against `AIAnalysis`**.
- **Timeout < 5 s** → on timeout, model error or validation failure, fall back to one of the **3 cached
  example responses** checked into `src/ai/fallbacks/` (urgent / monitoring / stable) and set
  `model: "gemini-flash (fallback)"` so it is never mistaken for a real answer.

### 7.5 Real geo for suggestions

`suggestedServices` and `suggestedHelpers` are no longer array scans: `ST_DWithin` + `ST_Distance`
against `services.location` and `users.location`, top 3, rounded to 0.1 km. `photo_hashes` growth is
handled by the existing `photo_hashes_subject_hash_idx`.

---

## 8. Realtime

Socket.IO gateway on `/realtime`, JWT in the handshake (`auth.token`), so an anonymous socket cannot
subscribe to case traffic.

| event | when | payload |
|---|---|---|
| `case.created` | a case is stored (only when it is **public**) | `{ case: Case }` |
| `case.updated` | status change, confirm, flag | `{ case: Case }` |
| `help.offered` | `POST /cases/:id/help` | `{ caseId, helper: UserLite, helpType }` |
| `notification` | a DB notification row is created (Phase 3 hook) | `{ notification }` |

Phase 2's `POST /cases/:id/help` also creates the `help` notification row for the reporter (port of
`store.ts`'s `notify(c.reporter.id, "help", …)`), so the table is exercised before Phase 3 lands.

---

## 9. Tests

### Unit

| suite | cases |
|---|---|
| `trust.service.spec.ts` | all 8 checks · scoring · hardFail · level thresholds · `suspicious → pending` · **the web's own cases** (verified, out-of-Algeria, duplicate, 6th/hour, nothing known) |
| `safety-rules.spec.ts` | every urgent keyword in FR/EN/AR/Darija forces urgent · tags too · rules only raise · contagious detection · `forcedUrgentByRule` propagation |
| `bbox.ts` spec | valid `minLng,minLat,maxLng,maxLat` · wrong arity · swapped order · out-of-range coordinates · envelope larger than the max span |
| `dhash.service.spec.ts` | identical image → distance 0 · resized/recompressed → ≤ 8 · different animal → > 8 |
| `exif.service.spec.ts` | reads GPS + `DateTimeOriginal` · no EXIF → `undefined` (verified: `exifr` returns `undefined`, never `null`, and never throws) · `GPSLatitude` N/S and `GPSLongitude` E/W signs |
| `serialize.spec.ts` | `passwordHash` never present · helpers embedded as `UserLite` · `trust.checks` in web order · `ai` passed through untouched · ISO dates |
| `ai.service.spec.ts` | mock provider shape · **safety override beats the model** · validation failure → fallback · all 3 fallbacks parse and match the type · `animalDetected` null with no photo |
| `realtime.gateway.spec.ts` | rejects a bad handshake token · emits the 4 events with the documented payload |

### E2E (`test/cases.e2e-spec.ts`, needs a DB — proves against the same throwaway container)

1. `POST /uploads/probe` with a real JPEG carrying GPS → EXIF returned, `probeId` issued
2. `POST /cases` → **response contains `ai` and `trust`**, `moderation` null for a verified reporter
3. the new case appears in `GET /cases?bbox=…` covering its point, and **not** in a bbox that excludes it
4. a `suspicious` case (out of Algeria / duplicate hash) is **absent** from the public bbox and present in `GET /admin/cases` for an admin
5. `POST /cases/:id/help` → `case.updated`/`help.offered` observed on a connected socket, and a `help` notification row for the reporter
6. `POST /cases/:id/confirm` twice → level rises to `verified`
7. `POST /cases/:id/flag` ×3 → `moderation: "pending"` disappears from the public map
8. `PATCH /cases/:id/status` by a volunteer → 200; by a reporter → `403 FORBIDDEN`
9. `POST /ai/analyze` with a DIFFERENT keyword language (AR) than the case → forced urgent
10. 6th report in an hour → `429 TRUST_RATE_LIMITED`

The e2e suite keeps the Phase 1 throttler-storage override and the DB gate (skip with a reason, never
pass silently). Fixtures: two small JPEGs (one with GPS EXIF, one identical recompressed) checked in
under `test/fixtures/`.

---

## 10. Execution order

| # | step | done when |
|---|---|---|
| 1 | `geo` module + the Algeria boundary + `ST_Within`/`ST_DWithin` helpers + spec | the polygon check agrees with the bbox on known points |
| 2 | `serialize.ts` (`caseRowToCase`) + spec | mapper green, no `passwordHash` anywhere |
| 3 | `bbox` parsing + spec | every invalid bbox answer is `VALIDATION_ERROR` |
| 4 | `dhash` + `exif` services + specs | both fixtures read correctly |
| 5 | `trust.service.ts` + spec | the web's cases all pass |
| 6 | `uploads` (`probe` + `signature`) + module | probe returns EXIF + dHash; no keys → typed `UPLOADS_NOT_CONFIGURED` |
| 7 | `ai`: safety rules → templates → provider interface → mock → fallbacks → Gemini + specs | safety override beats the model; fallbacks validate |
| 8 | `cases.service.readQueries` (`/cases`, `/nearby`, `/:id`) + controller | bbox works, moderation gated |
| 9 | `POST /cases` wiring trust + AI + hashes + events | response contains `ai` + `trust` |
| 10 | `help` / `confirm` / `flag` / `status` + notifications | `help.offered` reaches a socket |
| 11 | `realtime` gateway + JWT handshake + specs | the 4 events with their payloads |
| 12 | `admin` moderation endpoints + guard | a pending case becomes public |
| 13 | e2e suite | green against the real database |
| 14 | README + Swagger | `/docs` lists every new route |

Run after every step: `npm run lint`, `npm test`, `npx tsc --noEmit`.

---

## 11. Acceptance checklist

- [ ] `tsc` · `lint` · `build` · `npm test` · `npm run test:e2e` (with a DB) all clean
- [ ] a new migration **only** if `photo_probes` is adopted (§6) — flagged in `## Deviations`
- [ ] `GET /cases?bbox=` is one raw PostGIS statement, ordered `triage` then `createdAt DESC`
- [ ] `POST /cases` response contains `ai` and `trust`; the trust checks are all computed server-side
- [ ] a `suspicious` case is invisible to the public bbox and visible in `GET /admin/cases`
- [ ] safety rules override the model in **all four** languages and set `forcedUrgentByRule`
- [ ] the 3 cached fallbacks validate against the `AIAnalysis` shape and carry a distinct `model`
- [ ] `case.created` / `case.updated` / `help.offered` / `notification` all emit with documented payloads
- [ ] the web's own trust scenarios are ported as unit tests, not paraphrased
- [ ] no token, password, OTP or API key appears in any log line
- [ ] `.env.example` gains only the variables the new providers need

---

## 12. Open decisions / risks

| # | risk | recommendation |
|---|---|---|
| R1 | EXIF vs. "photos already uploaded" (§3.5 vs. §3.3) | `POST /uploads/probe` + a `photo_probes` table — flagged to the frontend dev before step 6 |
| R2 | `photo_probes` is not in §4's table list | confirm with the team; if refused, keep probe results in a 1-hour Redis/in-memory store and say so |
| R3 | ~~`sharp` prebuilt binaries may fail to install here~~ | **resolved** — verified installable and working here before this plan was written; keep the fallback note only if a teammate's box differs |
| R4 | no Algeria boundary is sourced in the repo | commit a **simplified** polygon under `src/geo/`, and keep the bbox `lat 18.9–37.2 / lng -8.7–12` as the fallback — the web's current behaviour. State which one is live |
| R5 | `animalDetected` cannot be real without Gemini | mock returns `true`/`null`; the trust check simply stays `null` when there is no photo, exactly like the web |
| R6 | moderation endpoints under `/admin/*` are Phase 4 in §7 | ship them in Phase 2 because the trust pipeline cannot be demonstrated without a pending→approved path; note it as a small phase overlap |
| R7 | the bbox query returns up to 500 rows with nested reporters and helpers | add a `limit`/`offset`, and reuse Phase 1's pagination envelope so the frontend's generated client does not change shape |
| R8 | Socket.IO handshake auth needs the access token on connect | `auth.token`; a bad or missing token is rejected in `handleConnection`, not silently ignored |
| R9 | **The two spec documents disagree about auth on `GET /cases`.** `BACKEND_PROMPT` §3.3 calls it *public*; `TEAM_HANDOFF` §5 says "login is required for everything except the landing page" | ship it **public** (BACKEND_PROMPT is the newer, backend-facing spec) but **confirm with the frontend dev before step 8** — it changes the generated client and the map's loading state, and flipping it later is a breaking change |
