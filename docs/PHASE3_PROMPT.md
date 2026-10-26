# PawLink Backend — Phase 3 Prompt (Marketplace + services + zones + notifications)

> Copy everything below the line into your AI IDE with **`apps/backend/`** as the working
> directory. `docs/BACKEND_PROMPT.md` remains the governing spec (§3 contracts · §6 rules ·
> §8 report format · `## Deviations`); this file is the Phase 3 work order only. Do **only**
> Phase 3, then STOP and report per §8.

---

You are the **backend developer on PawLink** (NestJS 11 · Prisma 7 · PostgreSQL/PostGIS ·
TypeScript strict · npm). Phases 0–2 are merged: foundation, auth, and the cases/trust/
realtime core. You are building **Phase 3 — the marketplace**: adoptions, services, reviews,
bookings, emergency zones, and notifications. The Next.js frontend (`apps/web/`, read-only
for you) already ships these screens on mock data — your API must match
`apps/web/lib/types.ts` **field for field**, because the frontend generates its typed client
from your Swagger.

**You may READ `apps/web/` and `docs/`. You may NOT modify them** — the only file you may
append to is `docs/BACKEND_PROMPT.md` → `## Deviations`.

## 0. Read first (these are the spec — do not guess)

| File | Why |
|---|---|
| `../docs/BACKEND_PROMPT.md` §3.3 · §3.6 · §6 · §8 | Endpoint surface, domain rules, non-negotiables, report format |
| `../docs/TEAM_HANDOFF.md` §4 + §5 | The adoption marketplace flow the frontend dev wrote for you |
| `../apps/web/lib/types.ts` | **Source of truth for every shape**: `AdoptionProfile`, `AdoptionRequest`, `Service`, `Booking`, `Review`, `AppNotification`, `NotificationKind`, `EmergencyZone` |
| `../apps/web/lib/store.ts` lines 166–250 | Every mutation, its target endpoint, and the exact notification each one fires (recipient · kind · subject · href) |
| `../apps/web/lib/mock/data.ts` | Seed data: `SERVICES`, `REVIEWS`, `ADOPTIONS`, `EMERGENCY_ZONES` |
| `../apps/web/app/adopt/new/page.tsx`, `components/adopt/AdoptionPanels.tsx`, `app/adopt/[id]/page.tsx` | How the UI posts a listing and **when it shows the phone** (the reveal rule you must enforce) |

## 1. Baseline — verified 2026-10-13

- **Green now:** `npm run build` · `npm run lint` · `npm test` = **16 suites / 226 tests** ·
  `npm run test:e2e` = 48/53 (the 5 failures are addressed in §2 Pre-flight).
- **Existing surface:** `/health`, `/auth/*` (6), `GET/PATCH/DELETE /me`, `/cases` (list with
  `bbox`+`zoneId`+filters, `nearby`, `:id`, `:status`, `:help`, `:confirm`, `:flag`),
  `/uploads/probe` + `/uploads/signature`, `/admin/cases/:id/moderation`, Socket.IO gateway.
- **Reuse these — do not reinvent them:**

| Need | Existing implementation |
|---|---|
| List envelope `{ items, total, page, pageSize }` | `Paginated<T>` + the `COUNT(*) OVER ()` raw-SQL pattern in `src/cases/cases.service.ts` |
| Row → wire shape | The `serialize.ts` pattern (`src/users/serialize.ts`, `src/cases/serialize.ts`); pass the **viewer** in, exactly like cases does, so phone-reveal rules live in one place |
| Auth | Global `JwtAuthGuard` (default-deny) + `@Public()`, `@Roles()`, `AdminGuard` — see `src/admin/admin-cases.controller.ts` for the admin route pattern |
| Notifications | `src/cases/cases.service.ts:569` already writes the row **and** pushes it: `this.realtime.notification({ notification })`. Extract/reuse this as a shared `NotificationsService` instead of duplicating it |
| Realtime | `src/realtime/events.ts` → `emitNotification`; gateway authenticated at handshake |
| Photo checks | `ExifService` + `DHashService` + the `POST /uploads/probe` → `PhotoProbe` pipeline cases uses; `PhotoHash` for stored hashes |
| Errors | `ApiError(status, CODE, message)` → the global `{ statusCode, message, code }` envelope |
| E2E harness | `test/global-setup.ts` (DB-skip helper) + the style of `test/auth.e2e-spec.ts` / `test/cases.e2e-spec.ts` |
| Geo | Trigger-maintained `location geography(Point,4326)`; GIST indexes already on `services`/`adoptions`/`emergency_zones` |

- **Database: all Phase 3 tables already exist** (`services`, `reviews`, `bookings`,
  `adoptions`, `adoption_requests`, `notifications`, `emergency_zones`), with the critical
  uniques in place: `reviews_service_author_unique` and
  `adoption_requests_adoption_user_unique`. Seed already loads 14 services, 5 reviews,
  6 adoptions, 1 zone. **Expect zero schema changes.**
  Migrations `20261003000000_init` + `20261010200738_photo_probes` are applied.

## 2. Pre-flight — align the stale AI tests with Deviation D6 (do this FIRST)

`test/cases.e2e-spec.ts` still tests the AI surface that **Deviation D6 removed** from the
backend (no `POST /ai/analyze`, no `Case.ai` writes — the AI lives in `apps/Ai/`). Five
assertions fail for that reason only:

1. Block `9 · POST /ai/analyze …` (4 tests, all 404) → **replace with ONE regression test**
   asserting `POST /ai/analyze` answers `404` with the standard error envelope, so the
   surface provably stays gone.
2. `expect(created.ai).toBeDefined()` (line ~253) → `expect(created.ai).toBeUndefined()`;
   the serializer intentionally omits `ai` (`Case.ai?` is optional in `shared/types.ts`).
   Keep every `trust` assertion.

Do **not** re-add any AI code. Then run `npm test` and `npm run test:e2e` — **both must be
100% green before you write any feature code.** Record this adjustment in `## Deviations`
(“Phase 3 pre-flight: stale AI assertions aligned to D6”).

## 3. Routes to build (exact surface — nothing more, nothing less)

All routes are authenticated by default (global guard). Lists **always** return the
`Paginated<T>` envelope (§3.1 + the `/cases` precedent). Add Swagger decorators in the style
of the existing controllers.

### 3.1 `/me` extensions
| Method | Route | Returns / notes |
|---|---|---|
| GET | `/me/adoptions` | `Paginated<AdoptionProfile>` — my listings, any status |
| GET | `/me/requests` | `Paginated<AdoptionRequest>` — requests I sent |
| GET | `/me/requests/received` | `Paginated<AdoptionRequest>` — requests on my listings |
| GET | `/me/bookings` | `Paginated<Booking>` — bookings I made |
| GET | `/me/notifications` | `Paginated<AppNotification>` — newest first |
| POST | `/me/notifications/read-all` | `204`, marks all of **my** rows read |

### 3.2 Adoptions
| Method | Route | Notes |
|---|---|---|
| GET | `/adoptions?status=&page=&pageSize=` | default `status=approved`; non-owners only ever see `approved` |
| GET | `/adoptions/:id` | `404` for non-approved listings unless owner/admin · **phone rule below** |
| POST | `/adoptions` | creates `status: "pending"`, `ownerId` from JWT · validations in §4.3 |
| PATCH | `/adoptions/:id` | owner only · content fields only — never `status`, never `ownerId` |
| POST | `/adoptions/:id/requests` | one request per user per listing (DB unique already exists) → `409 ADOPTION_REQUEST_EXISTS` · notifies owner `adoptRequest` |
| PATCH | `/requests/:id` | **listing owner only**, `{ status: "accepted" \| "declined" }` · terminal (`409 REQUEST_ALREADY_ANSWERED` if already decided) · notifies requester `adoptAccepted` / `adoptDeclined` |

### 3.3 Services · reviews · bookings
| Method | Route | Notes |
|---|---|---|
| GET | `/services?lat=&lng=&type=&radiusKm=&q=&page=` | approved services **plus my own** (any status) · radius = raw SQL `ST_DWithin` · ordering: `pro DESC` first, then `distance ASC` (geo query) or `rating DESC` · `q` = parameterized `ILIKE` on name/description/tags |
| GET | `/services/:id` | approved, or owner/admin |
| POST | `/services` | `status: "pending"`, owner from JWT (business/vet) |
| PATCH | `/services/:id` | owner only · content only — never `status`, `verified`, `pro`, `ownerId` |
| GET | `/services/:id/reviews` | `Paginated<Review>` |
| POST | `/services/:id/reviews` | one per user per service → `409 REVIEW_EXISTS` · rating `1|2|3|4|5` validated server-side · **recompute `rating` (AVG, 1 decimal) + `reviewCount` in the same transaction** · not on your own service (`403 REVIEW_OWNER`) · notifies owner `review` |
| PATCH | `/services/:id/reviews/:reviewId` | **service owner only**, `{ reply }` — powers `store.replyReview` |
| POST | `/services/:id/bookings` | `{ date, time, animal, reason }` → `status: "sent"`, `fromId` from JWT · notifies owner `booking` |
| PATCH | `/bookings/:id` | **service owner only**, `confirmed` \| `declined` → terminal · notifies booker `bookingConfirmed` / `bookingDeclined` |

### 3.4 Emergency zones
| Method | Route | Notes |
|---|---|---|
| GET | `/emergency-zones?active=&page=` | `Paginated<EmergencyZone>` · `polygon` as GeoJSON `[lng, lat]` · `center` computed by **`ST_Centroid`**, never trusted from the client · `stats: { cases, urgent, helpers }` computed with `ST_Intersects` against `cases.location` (+ `case_helpers`) |
| POST | `/emergency-zones` | **admin only** · validate polygon (valid GeoJSON Polygon, closed ring, sane Algeria bbox) → `ST_GeomFromGeoJSON` |
| PATCH | `/emergency-zones/:id` | admin only · polygon change ⇒ recompute `center` |
| DELETE | `/emergency-zones/:id` | admin only → `204` · check the FK from `cases.emergencyZoneId` first: if it blocks, answer `409 ZONE_IN_USE` (inspect the relation and handle whichever way it is declared — say which in your report) |

### 3.5 Admin decisions (the flow needs them; queue **listing** routes stay Phase 4)
| Method | Route | Notes |
|---|---|---|
| PATCH | `/admin/adoptions/:id` | admin · `{ status: "approved" \| "rejected" }` · notifies owner `listingApproved` / `listingRejected` |
| PATCH | `/admin/services/:id` | admin · approve ⇒ sets `status: "approved"`, `verified: true`, notifies owner `serviceApproved` · reject ⇒ `status: "rejected"` and **no notification** (match `store.moderateService` exactly) |

### 3.6 Realtime
Emit the existing `notification` event after every row insert, exactly the way
`cases.service.ts` does for `help`. No new event names.

## 4. Domain rules — non-negotiable, all enforced server-side

1. **Phone reveal matrix (headline rule).** `AdoptionProfile.ownerPhone` is included in a
   response **iff** the viewer is the listing owner, an admin, or has an **`accepted`**
   request on that listing. Everyone else → field omitted. `AdoptionRequest` **never**
   carries a phone (there is no field in `types.ts` — do not add one). This is exactly what
   `AdoptionPanels.tsx` / `adopt/[id]/page.tsx` render: `r.status === "accepted" && ownerPhone`.
2. **Ownership from the JWT only.** `ownerId`, `fromId`, `authorId` come from the token —
   never from the body. Admin only via `role === "admin"` in the JWT.
3. **State machines.** `adoption.status` changes **only** through the admin route;
   `request: sent → accepted | declined` (terminal); `booking: sent → confirmed | declined`
   (terminal). Illegal transition → `409` with a stable code, never a 500.
4. **One-per-user** rules are already DB uniques — catch Prisma `P2002` and answer
   `409 ADOPTION_REQUEST_EXISTS` / `409 REVIEW_EXISTS`.
5. **Adoption photos (§3.6).** Max 3 → `413/400 ADOPTION_TOO_MANY_PHOTOS`. Every photo URL
   must have a server-side probe from `POST /uploads/probe`: missing camera
   `Make` + `Model` + `DateTimeOriginal` → `400 ADOPTION_PHOTO_NO_EXIF`; pHash collision
   (≤ 8 Hamming, same threshold as cases) → `409 ADOPTION_PHOTO_DUPLICATE`. Reuse the
   existing probe/hash pipeline — read how `cases.service.ts` consumes it first.
6. **Never trust the client** for: `rating` bounds, `status`, `verified`, `pro`, `center`,
   `stats`, notification `subject`/`href` (built from DB rows + ids only), review averages.
7. **Throttling** (declare these values in Swagger): create adoption 5/10 min · adoption
   request 10/10 min · review 5/10 min · booking 10/10 min · service create 5/10 min —
   per account and per IP via `@Throttle`, on top of the global baseline.
8. **Notification mapping** (from `store.ts` — subject = the named person/place from the DB,
   href = the literal pattern):

| kind | fired by | recipient | subject | href |
|---|---|---|---|---|
| `adoptRequest` | POST `/adoptions/:id/requests` | listing owner | requester name | `/account?tab=requests` |
| `adoptAccepted` / `adoptDeclined` | PATCH `/requests/:id` | requester | animal name | `/adopt/{id}` |
| `listingApproved` / `listingRejected` | PATCH `/admin/adoptions/:id` | owner | animal name | `/adopt/{id}` |
| `booking` | POST `/services/:id/bookings` | service owner | booker name | `/account?tab=pro` |
| `bookingConfirmed` / `bookingDeclined` | PATCH `/bookings/:id` | booker | service name | `/services/{id}` |
| `review` | POST `/services/:id/reviews` | service owner | author name | `/services/{id}` |
| `serviceApproved` | PATCH `/admin/services/:id` (approve only) | owner | service name | `/services/{id}` |
| `help` | already shipped in Phase 2 — reuse, don't duplicate | — | — | — |
| `proActive` | **reserved** — payments/pro activation are out of scope | — | — | — |

9. **`shelter` on `AdoptionProfile`** is `{ id, name }` joined from `shelterId` → Service;
   when `shelterId` is null, answer `{ id: ownerId, name: owner.name }` and document it.

## 5. Serialization contract

One `serialize.ts` per module, following `users/serialize.ts`/`cases/serialize.ts`: dates →
ISO 8601 UTC strings; optional fields omitted (`undefined`), never `null` unless the type
says `| null`; `EmergencyZone.polygon` is GeoJSON **`[lng, lat]`** order — the only place
that order is allowed; distances in km, rounded the same way `withDistances` rounds in
`cases.service.ts` (match it exactly); ids are strings. The phone rule from §4.1 is applied
in serialization with the viewer passed in — never “filter later in the controller”.

## 6. Database rules

- **No schema changes expected.** If one is genuinely required: `npx prisma migrate dev`
  (must stay drift-free), then `npx prisma generate`, then report it as a deviation.
- Raw SQL (`$queryRaw` with `Prisma.sql` parameters — **zero string interpolation**):
  table names are lowercase (`services`, `adoptions`, `adoption_requests`,
  `emergency_zones`, `notifications`, `cases`); camelCase columns are quoted
  (`"createdAt"`, `"reviewCount"`, `"ownerId"`). Never write `location`/`polygon` directly —
  triggers maintain them.

## 7. Acceptance — “done” means all of this

**Unit tests**
- Phone matrix: owner ✓ · admin ✓ · accepted requester ✓ · pending requester ✗ · other
  user ✗ (5 cases, in the serializer/service).
- Request/booking/review state machines + every `409`; rating recompute (avg + count);
  the full notification mapping table (kind · recipient · subject · href);
  zone polygon validation + `stats` SQL; services ordering (pro first) + radius exclusion.

**E2E — new `test/marketplace.e2e-spec.ts`** (follow the `global-setup.ts` DB-skip helper)
1. **Headline (Phase 3 acceptance):** requester sends a request → owner accepts →
   `GET /adoptions/:id` **contains `ownerPhone` for the requester**; a declined request on
   another listing → **absent** (also assert: absent for a stranger, absent before the
   decision).
2. **Headline:** one review per user per service — second POST → `409 REVIEW_EXISTS`;
   `rating`/`reviewCount` updated exactly once.
3. Admin approves a pending adoption → visible in `GET /adoptions?status=approved` +
   `listingApproved` notification row exists; non-admin PATCH → `403`.
4. Booking flow: create → service owner confirms → booker has a `bookingConfirmed`
   notification and the booking reads `confirmed`.
5. `GET /me/notifications` returns rows; `read-all` marks them.
6. Zones: `GET` returns the seeded zone with GeoJSON polygon + non-zero stats; `POST` as
   admin works, as reporter → `403`.
7. `GET /services?lat&lng&radiusKm` excludes a far-away service and puts `pro` first.
8. A socket receives the `notification` event (copy the socket pattern from `cases.e2e`).

**Gate (every item, no exceptions):** `npm run build` · `npm run lint` · `npm test` ·
`npm run test:e2e` **with a reachable DB** (state plainly if they were skipped) ·
`/docs` documents every new route · `npm run seed` still runs · then STOP and report per
§8 of `BACKEND_PROMPT.md` (routes table · commands · test results · deviations appended ·
anything you could not do).

## 8. Out of scope — do not build these

- Anything AI (Deviation D6: no `POST /ai/analyze`, no AI imports, `animalDetected` stays
  `null`).
- Payments / Pro activation (`proActive` stays reserved).
- Phase 4: `/admin/stats`, `/admin/users`, moderation **queue listings**, README, rate-limit
  retuning.
- Edits to `apps/web/`, `apps/mobile/`, `brand/`, `docs/` (except appending Deviations).
- New npm dependencies — everything Phase 3 needs is already installed.

## 9. Pitfalls already paid for — don't pay again

- Added/changed deps in `package.json` → run `npm install`. Changed `schema.prisma` → run
  `npx prisma generate`. A **stale Prisma client** shows bizarre TS errors
  (`Property 'x' does not exist on PrismaClient`).
- PowerShell eats `--flags` through `npm.ps1`: use
  `npm.cmd run seed:admin -- --email you@pawlink.dz --password <secret>`.
- E2E needs a reachable DB: real Supabase URLs in `apps/backend/.env`, **or** the local
  Docker harness `pawlink-pg` on `127.0.0.1:55432` (image already pulled) with
  `SUPABASE_DB_URL`/`DATABASE_URL` set for that run. Suites **skip loudly** when the DB is
  down, but compile errors still fail — report which mode you used.
- `.env` is a read-only secret store: never print, echo, or quote its values.
- Jest may warn “did not exit” after the e2e run — it is a known cosmetic issue; the
  pass/fail counts are what matter.
