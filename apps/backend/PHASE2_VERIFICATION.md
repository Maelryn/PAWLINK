# Phase 2 — verification plan

> Companion to `PHASE2_PLAN.md`. That file says what to build; this one says **how to prove it
> works**, with the command and the expected output for every check.
>
> The rule that shaped it: a check that can pass silently is not a check. Anything that cannot run
> must report itself as **skipped with the reason**, never as green.

---

## 0. Status at the time of writing

| Step | Built | Unit tests | Proven against a real database |
|---|---|---|---|
| 1 · geo boundary | ✅ | 13 | ✅ polygon vs bbox, 10 probe points |
| 2 · case serializer | ✅ | 12 | — |
| 3 · bbox parsing | ✅ | 13 | — |
| 4 · EXIF + dHash | ✅ | 28 | ✅ real fixtures, real `exifr`/`sharp` |
| 5 · trust pipeline | ✅ | 35 | ⬜ needs the case routes |
| 6 · uploads | ⬜ | — | — |
| 7 · AI | ⬜ | — | — |
| 8 · case reads | ⬜ | — | ⬜ bbox, moderation gating |
| 9 · `POST /cases` | ⬜ | — | ⬜ **the headline acceptance** |
| 10 · community | ⬜ | — | ⬜ help/confirm/flag |
| 11 · realtime | ⬜ | — | ⬜ socket events |
| 12 · admin moderation | ⬜ | — | ⬜ pending → approved |
| 13 · e2e | ⬜ | — | ⬜ the whole flow |
| 14 · docs | ⬜ | — | — |

**Totals so far: 197 unit tests, `tsc` and `lint` clean.**

---

## 1. The environment

Two tiers, because one of the acceptance criteria is about PostGIS specifically.

### Tier A — throwaway PostgreSQL + PostGIS (no credentials needed)

Proved twice already, so it is part of the standard procedure. It covers every check except the
Supabase connection pooler.

```bash
docker rm -f pawlink-verify 2>/dev/null
docker run -d --name pawlink-verify \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=pawlink -p 55432:5432 postgis/postgis:17-3.5

export SUPABASE_DB_URL="postgresql://postgres:postgres@127.0.0.1:55432/pawlink"
export DATABASE_URL="$SUPABASE_DB_URL"
```

Expected: `PostgreSQL 17.5 + PostGIS 3.5.2`.

### Tier B — real Supabase (needs `apps/backend/.env`)

The only extra thing it proves is the **session pooler on port 6543** that §5 of the prompt requires
at runtime, and that the creds the human owns actually work. Until then it stays on the list as
unproven, and that is stated in the report rather than quietly dropped.

---

## 2. Static gates — run after every step

```bash
cd apps/backend
npx tsc --noEmit     # type errors, including the ones `nest build` hides in scripts/
npm run lint         # eslint, flat config
npm run build        # nest build
npm test             # unit
```

Expected: all exit 0, and `npm test` above 197 and rising.

> Learned in Phase 1: `nest build` **excludes `scripts/`**, so a type error in a script is invisible
> to the build. `tsc --noEmit` is the only gate that catches `scripts/seed.ts` and
> `scripts/make-fixtures.ts`.

---

## 3. Database gates — Tier A

```bash
npx prisma validate
npx prisma migrate status     # before: 1 migration not yet applied
npx prisma migrate deploy     # applies it
npx prisma migrate status     # after: "Database schema is up to date!"
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

Expected output for the last two, from the earlier run:

```
Database schema is up to date!
```

```
No difference detected.          # exit code 0
```

Then the seed, which §7's "seed still runs" requirement means every phase must re-check:

```bash
npm run seed
```

Expected: `users:11 zones:1 cases:27 helpers:13 trustChecks:189 services:14 reviews:5 adoptions:6`
— and **the counts must not move** between phases, because a change means the port stopped matching
`apps/web/lib/mock/data.ts`.

One fact worth knowing before writing the case tests: **the seed already contains 1 case with
`moderation = 'pending'` and 26 `approved`**, so the public-map gating is exercised by the demo data
without a hand-crafted suspicious case.

---

## 4. Feature verification matrix

Each row is executable. "Expected" is what a pass looks like; anything else is a bug, not a flake.

### 4.1 `GET /cases?bbox=`

| # | Check | Command | Expected |
|---|---|---|---|
| 1 | bbox returns the cases inside it | `curl -s 'localhost:4000/cases?bbox=3.9,36.5,4.4,36.9'` | ~12 cases, urgent first |
| 2 | a case outside the bbox is absent | bbox around Algiers only, assert no Tizi Ouzou case | the Kabylie wildfire case is missing |
| 3 | ordering | first item's `triage` is `urgent` | urgent → monitoring → stable, then `createdAt DESC` |
| 4 | a **pending** case never appears | grep the response for the seeded pending case's id | absent |
| 5 | filters compose | `?bbox=…&triage=urgent&species=dog&category=livestock` | every item matches all three |
| 6 | bad bbox is a 400 envelope | `?bbox=,,,` | `{statusCode:400,code:"VALIDATION_ERROR"}` |
| 7 | pagination envelope | `?bbox=…&page=2&pageSize=5` | `{items,total,page,pageSize}`, `total` is the full count |

### 4.2 `POST /cases` — **the headline acceptance**

| # | Check | Expected |
|---|---|---|
| 1 | response contains `ai` **and** `trust` | both objects present, `trust.level` one of the three |
| 2 | the new case appears in the bbox query | the created id is in the list from 4.1 #1 |
| 3 | a verified reporter stays public | `moderation` is absent (null), not `"pending"` |
| 4 | an out-of-Algeria pin is held | `moderation: "pending"`, absent from the public bbox, present in `GET /admin/cases` |
| 5 | a reused photo is held | upload the same JPEG twice → second case is `pending`, `duplicate` check is `false` with a detail string |
| 6 | the 6th report in an hour is refused | `429 TRUST_RATE_LIMITED` |
| 7 | a reporter cannot spoof `trust` | send `{"trust":{"level":"verified"}}` → ignored, recomputed |
| 8 | `POST /cases/:id/status` by a volunteer | 200 |
| 9 | the same by a reporter | `403 FORBIDDEN` |

### 4.3 Trust pipeline

| # | Check | Expected |
|---|---|---|
| 1 | the web's scenarios, ported | unit suite green (35 tests) — `verified`, out-of-Algeria, duplicate, 6th/hour, nothing known |
| 2 | thresholds are the web's | 2 km / 48 h / 5 per hour, asserted as constants in the spec |
| 3 | EXIF-less photo | `photoGps` and `photoFresh` are `ok: null`, **not** `false` |
| 4 | the 8 checks are server-computed | a request carrying a hand-made `trust` object changes nothing |
| 5 | `suspicious` ⇒ hidden | invisible on the public bbox, visible to the reporter and to an admin |

### 4.4 Uploads

| # | Check | Expected |
|---|---|---|
| 1 | `POST /uploads/probe` on `test/fixtures/with-exif.jpg` | returns `probeId`, `exif.gps = {lat:36.632,lng:4.205}`, a 16-hex dHash |
| 2 | the same on `no-exif.jpg` | `exif` is empty, no error |
| 3 | dHash survives re-encoding | probe `with-exif.jpg` then `recompressed.jpg` → both `probeId`s report the same photo |
| 4 | dHash separates images | `different.jpg` → distance above the threshold of 8 |
| 5 | no Cloudinary keys | `POST /uploads/signature` → typed `UPLOADS_NOT_CONFIGURED` (501), never a 500 |

### 4.5 AI

| # | Check | Expected |
|---|---|---|
| 1 | safety rules override the model | a keyword in **each** of FR / EN / AR / Darija forces `triage: "urgent"` and `forcedUrgentByRule: true` |
| 2 | rules only raise | a baseline of `urgent` with a stable description stays `urgent` |
| 3 | the 3 cached fallbacks validate | each parses against `AIAnalysis` and carries a distinct `model` string |
| 4 | a model failure falls back | force a bad `GEMINI_API_KEY` or a timeout → the fallback is returned, not an error |
| 5 | `disclaimer` is always present | on every path, including the fallbacks |
| 6 | `animalDetected` | `true` with a photo, `null` without — and `null` when the provider cannot tell |
| 7 | suggestions are real geo | `suggestedServices` distances match an independent `ST_Distance` query |

### 4.6 Realtime

| # | Check | Expected |
|---|---|---|
| 1 | a bad handshake is rejected | connect without a token → `connect_error` |
| 2 | `case.created` | create a case → a connected socket receives it, and only when the case is public |
| 3 | `case.updated` | `PATCH /cases/:id/status` → socket receives the new case |
| 4 | `help.offered` | `POST /cases/:id/help` → socket receives `{caseId, helper, helpType}` and a `help` notification row exists for the reporter |
| 5 | a pending case does not broadcast | create a suspicious case → no `case.created` |

### 4.7 Moderation

| # | Check | Expected |
|---|---|---|
| 1 | admin approves | `PATCH /admin/cases/:id/moderation` with `approved` → the case appears on the public bbox |
| 2 | admin hides | `hidden` → it disappears |
| 3 | a non-admin is refused | `403 FORBIDDEN` |
| 4 | confirm raises trust | two `POST /cases/:id/confirm` → `trust.level` becomes `verified` |
| 5 | flag ×3 | third flag → `moderation: "pending"`, gone from the public map |

### 4.8 Swagger — §7 requires `/docs` to be up to date

```bash
curl -s localhost:4000/docs-json | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);for(const [p,m] of Object.entries(j.paths)) for(const k of Object.keys(m)) console.log(k.toUpperCase(), p)})"
```

Expected: every route in §5 of `PHASE2_PLAN.md` is listed, each with request and response schemas.
The frontend generates its typed client from this, so a missing schema is a Phase 3 blocker.

---

## 5. The e2e suite (`test/cases.e2e-spec.ts`)

The single artefact that proves the phase, because it exercises the routes together rather than in
isolation. It must keep two rules from Phase 1:

- **skip with a reason, never pass silently** — `test/global-setup.ts` writes the DB marker and the
  suite reports `skipped` with the reason printed.
- **override the throttler *storage*** (`overrideProvider(getStorageToken())`), not the guard:
  `overrideGuard` does not reach an APP_GUARD and the suite would silently trip the 5-per-10-minute
  register limit.

Sequence, in order (from `PHASE2_PLAN.md` §9): probe → create → appears in bbox → suspicious case
held → help + socket event → confirm ×2 → flag ×3 → status by role → AI in a second language →
6th report rate-limited.

Against Tier A the expected result is **`21 + the new case tests` passing, 0 skipped**.

---

## 6. Live smoke test — the part unit tests cannot fake

Boot the server and drive it with `curl`, because it is the only way to see the codes the routes
actually return:

```bash
npm start &
curl -s localhost:4000/health                       # 200, db "up"
curl -s -X POST localhost:4000/auth/register …      # 202 + code (log shows a masked phone)
curl -s -X POST localhost:4000/auth/verify-phone …  # 200 + refresh cookie
curl -s -X POST localhost:4000/cases -H "Authorization: Bearer $TOKEN" -d @case.json
```

Expected: the case response carries `ai` and `trust`, the seeded-user login still works with
`pawlink2026`, and a deliberate `DELETE /me` leaves the row anonymised with **0 orphaned rows** on
`cases.reporterId`.

---

## 7. Things that would only show up here

The reason this section exists is that every one of them was found by *running* the thing, in Phase 1:

| Class of bug | How it would be caught |
|---|---|
| a route answering `201` instead of the documented status | the e2e's `expect(200)` / `expect(204)` |
| "rotation" that emits the same token | asserting the new value differs from the old |
| a guard registered as APP_GUARD that a test override cannot reach | the suite hitting a `429` it did not expect |
| a DB failure answered as `500` | the filter test, plus a live `curl` with the DB down |
| a migration that never applied | `prisma migrate status` on a fresh container |
| a seed that no longer matches the web mock | the fixed counts in §3 |
| a genuinely suspicious report leaking onto the public map | 4.2 #4 and 4.7 |

---

## 8. What cannot be proven locally, and must be said out loud

| Gap | Why | What closes it |
|---|---|---|
| the Supabase session pooler (port 6543) | no credentials | Tier B |
| real Gemini vision for `animalDetected` | needs `GEMINI_API_KEY` | a Tier B run with `AI_PROVIDER=gemini` |
| Cloudinary signature validity | needs the API secret | a Tier B run with the keys set |
| Twilio delivery | needs the account | a Tier B run with `SMS_PROVIDER=twilio` |
| a real camera photo's EXIF | fixtures are generated | one photo from a phone, confirmed by eye |

Every one of these degrades gracefully by design, so their absence must not be mistaken for a
failure — but "not verified here" belongs in the report, not in a footnote.

---

## 9. Sign-off

Copy into the phase report, fill in, and do not mark a row green until the command has been run.

| Criterion | Command | Result |
|---|---|---|
| builds clean | `npm run build` | |
| lint clean | `npm run lint` | |
| types clean (incl. `scripts/`) | `npx tsc --noEmit` | |
| unit tests green | `npm test` | |
| e2e green with a DB | `npm run test:e2e` (Tier A) | |
| migration applies, no drift | §3 | |
| seed still runs, counts unchanged | §3 | |
| `POST /cases` returns `ai` + `trust` | §4.2 | |
| the created case appears in the bbox | §4.2 #2 | |
| a suspicious case is hidden | §4.2 #4, §4.7 | |
| safety rules override in 4 languages | §4.5 #1 | |
| the 3 fallbacks validate | §4.5 #3 | |
| realtime emits all 4 events | §4.6 | |
| `/docs` lists every route | §4.8 | |
| no secret in any log line | grep the boot log | |
