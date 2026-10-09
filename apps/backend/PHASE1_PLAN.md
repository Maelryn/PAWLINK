# PawLink Backend — Phase 1 plan (Auth + profile)

> Working document for the next phase on `apps/backend/`. Scope fixed by
> `../docs/BACKEND_PROMPT.md` §7 *Phase 1 — Auth + profile*.
> Phase 0 is committed (`5a12053` + re-audit). This file does not change any contract — it
> only sequences the work.

> **Status: implemented** (commit `phase 1` on `backend1`). §12 records what was built, and the
> four places where the implementation had to go slightly beyond this plan.

**Phase 1 in one line:** `POST /auth/register` → SMS OTP → `POST /auth/verify-phone` →
`POST /auth/login` → `POST /auth/refresh` → `POST /auth/logout` → `GET/PATCH/DELETE /me`,
plus the guards, throttling and the `console`/`twilio` SMS providers.

---

## 1. Scope

### In scope

| Area | Deliverable |
|---|---|
| Auth routes | `POST /auth/register`, `/auth/verify-phone`, `/auth/resend-code`, `/auth/login`, `/auth/refresh`, `/auth/logout` |
| Profile routes | `GET /me`, `PATCH /me`, `DELETE /me` |
| Security | `JwtAuthGuard`, `RolesGuard`, `AdminGuard`, `@Roles()` / `@CurrentUser()` decorators |
| OTP | `phone_otps` CRUD, 6 digits, 5 min TTL, max 5 attempts, code returned only when `NODE_ENV !== "production"` |
| Passwords | `argon2` via the already-installed `@node-rs/argon2` (same as the seed) |
| Tokens | access JWT in the response body, refresh JWT in an httpOnly cookie |
| SMS | `SmsProvider` interface + `ConsoleSmsProvider` (default) + `TwilioSmsProvider` |
| Rate limits | per-route throttles (register, login, verify, resend) on top of the global 100/min |
| Serialization | `userRowToUser()` — the single row → `User` (`apps/web/lib/types.ts`) mapper |
| Tests | unit (OTP service, token service, mapper) + e2e (the whole acceptance flow) |

### Out of scope (and where it lands)

| Deferred | Lands in |
|---|---|
| `GET /me/adoptions`, `/me/requests`, `/me/requests/received`, `/me/bookings` | Phase 3 (needs adoption + booking tables wired to routes) |
| `GET /me/notifications`, `POST /me/notifications/read-all` | Phase 3 (notifications module) |
| `POST /cases`, trust pipeline, `/ai/analyze`, Socket.IO | Phase 2 |
| `PATCH /admin/users/:id/role`, `/admin/*` | Phase 4 |
| The `pending` **Service row** a `vet`/`pro` sign-up implies (web `signUp()` creates one with `ownerId`) | Phase 3 — see §7 risk R2 |

---

## 2. Contracts that must hold (from `docs/BACKEND_PROMPT.md`)

1. **Envelope** — every error is `{ statusCode, message, code }` (Phase 0 filter already does this; Phase 1 only adds codes, never bypasses it).
2. **Tokens** — access token in the **body**, refresh token in an **httpOnly cookie**. JWT payload is exactly `{ sub, role, name }`.
3. **Admin is never signable-up.** `admin` is rejected at the DTO level with `AUTH_ROLE_NOT_ALLOWED`, and `RolesGuard` re-checks the role from the JWT on every admin route — the UI hiding is cosmetic.
4. **A `vet` sign-up stays `reporter`** until an admin sets `licenseVerified: true` (Phase 4 `PATCH /admin/users/:id/role`).
5. **Dates** ISO 8601 UTC, **IDs** strings (cuid), field names exactly `User` in `apps/web/lib/types.ts` (see §6).
6. **Never log** tokens, passwords or OTP codes.
7. Everything must run with `AI_PROVIDER=mock` / `SMS_PROVIDER=console` and no Cloudinary keys — Phase 1 adds no new third-party requirement.

---

## 3. Files to create

```
apps/backend/src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts            # /auth/*
│   ├── auth.service.ts               # register / verify / login / refresh / logout
│   ├── auth.service.spec.ts
│   ├── dto/
│   │   ├── register.dto.ts           # name, email, password, phone, role
│   │   ├── login.dto.ts              # email, password
│   │   ├── verify-phone.dto.ts       # code
│   │   └── resend-code.dto.ts        # phone  (reuse register rules)
│   ├── tokens.service.ts             # signAccess / signRefresh / verifyRefresh
│   ├── tokens.service.spec.ts
│   ├── otp.service.ts                # issue / check / attempts / expiry
│   ├── otp.service.spec.ts
│   └── guards/
│       ├── jwt-auth.guard.ts
│       ├── roles.guard.ts
│       └── admin.guard.ts
├── users/
│   ├── users.module.ts
│   ├── users.service.ts              # findByEmail, findById, create, update, soft-delete
│   ├── users.service.spec.ts
│   ├── serialize.ts                  # userRowToUser() + userRowToUserLite()
│   └── serialize.spec.ts
├── sms/
│   ├── sms.module.ts
│   ├── sms.provider.ts               # interface + SMS_PROVIDER token
│   ├── console-sms.provider.ts       # default: logs + DB row, never leaks in prod
│   ├── twilio-sms.provider.ts        # optional, env-gated
│   └── sms.service.ts                # sendOtp() — picks the provider
├── common/
│   ├── decorators/
│   │   ├── roles.decorator.ts        # @Roles('admin')
│   │   ├── current-user.decorator.ts # @CurrentUser() → { sub, role, name }
│   │   └── public.decorator.ts       # for the future refresh/logout pair if needed
│   └── guards/… (see auth/guards — keep guards with auth, decorators with common)
└── me/
    ├── me.module.ts
    ├── me.controller.ts              # GET/PATCH/DELETE /me
    ├── me.service.ts
    └── dto/update-me.dto.ts
```

`app.module.ts` gains `AuthModule`, `UsersModule`, `SmsModule`, `MeModule` (all thin, all
importing the shared `PrismaModule`).

---

## 4. Endpoints (Phase 1 surface)

All under the global prefix — no prefix, exactly as §3.3 lists them.

| Method | Route | Auth | Throttle | Success |
|---|---|---|---|---|
| POST | `/auth/register` | public | 5 / 10 min / IP | `202` `{ phone, code? }` (code only when `NODE_ENV !== "production"`) |
| POST | `/auth/verify-phone` | public | 10 / 10 min / IP | `200` `{ accessToken, user }` + refresh cookie |
| POST | `/auth/resend-code` | public | 3 / 10 min / IP | `202` `{ phone, code? }` |
| POST | `/auth/login` | public | 10 / 10 min / IP | `200` `{ accessToken, user }` + refresh cookie |
| POST | `/auth/refresh` | cookie | 30 / min | `200` `{ accessToken }` + new refresh cookie |
| POST | `/auth/logout` | cookie | 30 / min | `204`, cookie cleared |
| GET | `/me` | bearer | global | `200` `User` |
| PATCH | `/me` | bearer | 20 / min | `200` `User` |
| DELETE | `/me` | bearer | 3 / hour | `204` (soft delete or anonymise — see R4) |

### Request bodies

```ts
// POST /auth/register
{ name: string, email: string, password: string, phone: string,
  role: "reporter" | "volunteer" | "vet",           // never "admin"
  city?: string, helpTypes?: HelpType[] }

// POST /auth/verify-phone   { code: string }   // 6 digits, bound to the newest OTP for that phone
// POST /auth/resend-code    { phone: string }
// POST /auth/login          { email: string, password: string }

// PATCH /me  (all optional, whitelisted)
{ name?, avatar?, phone?, city?, bio?, photo?, location?: GeoPoint,
  available?, helpTypes?: HelpType[] }
```

`role` values accepted by the DTO: `reporter | volunteer | vet`. `pro` (web `SignUpRole`)
is **not** a server role — a `pro`/business sign-up arrives as `role: "vet"` or a plain
`reporter` plus business fields, and the listing itself is Phase 3. Rejecting `admin`
explicitly with `AUTH_ROLE_NOT_ALLOWED` is required, not optional.

### Responses

```ts
// { accessToken, user }
{ accessToken: string, user: User }        // User = apps/web/lib/types.ts field-for-field
```

Refresh cookie: `refreshToken`, `httpOnly: true`, `sameSite: "lax"`, `secure` when
`NODE_ENV === "production"`, `path: /auth` (refresh + logout only), `maxAge` = `JWT_REFRESH_TTL`.

---

## 5. Auth mechanics

### JWT

| | value |
|---|---|
| Access secret / TTL | `JWT_ACCESS_SECRET` / `JWT_ACCESS_TTL` (default `15m`) |
| Refresh secret / TTL | `JWT_REFRESH_SECRET` / `JWT_REFRESH_TTL` (default `30d`) |
| Payload | `{ sub: user.id, role: user.role, name: user.name }` — nothing else |
| Verify | `@nestjs/jwt` `verifyAsync`, separate secrets, `issuer: "pawlink"` (`JWT_ISSUER`) |

**Refresh rotation** (recommended): each `POST /auth/refresh` issues a **new** refresh cookie
too. Rotation without a server-side denylist is still vulnerable to replay of a stolen cookie,
so log the rotation and keep the design open for a `refresh_tokens` table in Phase 4 hardening
(the prompt's table list does not include one — flag before adding).

### OTP lifecycle (`phone_otps`)

| step | rule |
|---|---|
| issue | 6 digits from `crypto.randomInt` (**never** `Math.random`) |
| TTL | 5 min (`expiresAt = now + 5m`) |
| attempts | `attempts` starts at 0; each wrong code `+1`; at **5** the row is dead → `AUTH_OTP_TOO_MANY_ATTEMPTS` and a new code must be requested |
| resend | invalidates previous live rows for that phone (or ignores them — one live code per phone) |
| delivery | `SmsProvider.send(to, code)`; `ConsoleSmsProvider` logs it and, when `NODE_ENV !== "production"`, the controller includes it in the response |
| verify | match on `code` + not expired + `attempts < 5` → set `user.phoneVerified = true`, delete the rows |

**Never** store the code in plaintext beyond the 5-minute window, never return it when
`NODE_ENV === "production"`, never log it.

### Rate limiting

Global (Phase 0): 100 req / 60 s. Phase 1 adds `@Throttle({ default: { limit, ttl } })` per
route as in the table above. The **5 reports/hour** limit is Phase 2 (`TRUST_RATE_LIMITED`),
not here — but the throttler config must be structured so the Phase 2 override is one decorator.

---

## 6. Serialization — the frontend parity rule

One mapper, used by every response, so the generated typed client never drifts:

```ts
export function userRowToUser(u: UserRow): User {
  return {
    id: u.id,
    name: u.name,
    avatar: u.avatar,
    role: u.role,                       // Role enum, already string-identical
    email: u.email ?? undefined,        // optional in types.ts → omit, never null
    phone: u.phone ?? undefined,
    phoneVerified: u.phoneVerified,
    licenseVerified: u.licenseVerified,
    helpTypes: u.helpTypes,             // HelpType[] (empty array is fine)
    location: u.lat != null && u.lng != null
      ? { lat: u.lat, lng: u.lng, address: u.address ?? undefined }
      : undefined,
    rating: u.rating ?? undefined,
    city: u.city ?? undefined,
    bio: u.bio ?? undefined,
    photo: u.photo ?? undefined,
    available: u.available ?? undefined,
    serviceId: u.serviceId ?? undefined,
    pro: u.pro ? { plan: "pro", since, until } : undefined,
    createdAt: u.createdAt.toISOString(),
  };
}
```

Rules: **never leak `passwordHash`** (the row type must not even be spread), optional fields are
omitted rather than `null`, dates are ISO strings, `pro` is validated `Json` and reshaped, not
passed through raw.

---

## 7. Error codes (new in Phase 1)

Stable machine strings, thrown as `new ApiError(status, code, message)`:

| code | status | when |
|---|---|---|
| `AUTH_EMAIL_TAKEN` | 409 | register with an existing email |
| `AUTH_INVALID_CREDENTIALS` | 401 | login with a wrong email/password pair (never say which) |
| `AUTH_PHONE_NOT_VERIFIED` | 403 | login before the OTP was confirmed |
| `AUTH_OTP_INVALID` | 400 | wrong or expired code |
| `AUTH_OTP_TOO_MANY_ATTEMPTS` | 429 | 5 wrong codes on one OTP row |
| `AUTH_ROLE_NOT_ALLOWED` | 400 | `role: "admin"` on register |
| `AUTH_TOKEN_INVALID` / `AUTH_TOKEN_EXIRED` | 401 | bad/expired access or refresh token |
| `AUTH_NO_REFRESH_COOKIE` | 401 | `/auth/refresh` without the cookie |
| `VALIDATION_ERROR` | 400 | already produced by `ValidationPipe` + the Phase 0 filter |
| `DB_UNAVAILABLE` | 503 | already produced by the Phase 0 filter |
| `UPLOADS_NOT_CONFIGURED` | 501 | referenced by the README; arrives with Phase 2 uploads |

Guard denials: `AUTH_UNAUTHORIZED` (401, no/invalid bearer) and `FORBIDDEN` (403, wrong role).

---

## 8. Test plan

### Unit (Jest, `src/**/*.spec.ts`)

| suite | cases |
|---|---|
| `auth.service.spec.ts` | register creates a `reporter` + OTP row and never returns a hash · registering `admin` throws `AUTH_ROLE_NOT_ALLOWED` · verify-phone sets `phoneVerified` and clears OTPs · 5 wrong attempts kills the code · login with an unverified phone throws · login with a bad password throws `AUTH_INVALID_CREDENTIALS` |
| `otp.service.spec.ts` | 6 digits · 5-minute TTL · attempt counter · resend supersedes the old code |
| `tokens.service.spec.ts` | access/refresh payload is exactly `{ sub, role, name }` · separate secrets · expired token rejected |
| `serialize.spec.ts` | optional fields omitted not `null` · `passwordHash` absent from the output · date is ISO · `pro` reshaped |
| `users.service.spec.ts` | `findByEmail` is case-insensitive and trimmed (web `signIn` trims/lowercases) |

### E2E (`test/auth.e2e-spec.ts`, `--runInBand`, real Nest app + real DB)

The acceptance flow, in one file, in order:

1. `POST /auth/register` → `202`, a `phone_otps` row exists, no `passwordHash` in the response
2. `POST /auth/verify-phone` with the console code → `200` `{ accessToken, user }` + refresh cookie set
3. `GET /me` with the bearer → `200` and the same user
4. `POST /auth/refresh` with the cookie → `200` `{ accessToken }` (old one ideally rejected)
5. `POST /auth/logout` → `204`, cookie cleared
6. **Role denial**: a `reporter` token hitting an admin-only route → `403 FORBIDDEN`
7. `POST /auth/register` with `role: "admin"` → `400 AUTH_ROLE_NOT_ALLOWED`
8. `POST /auth/login` with a wrong password → `401 AUTH_INVALID_CREDENTIALS`
9. 6th wrong OTP → `429 AUTH_OTP_TOO_MANY_ATTEMPTS`
10. `DELETE /me` → `204`, then `GET /me` with the old token → `401`

`test/jest-e2e.json` needs a `setupFiles`/globalSetup that guarantees a reachable DB, and the
suite must be skipped with a clear message (not silently passing) when `DATABASE_URL` is absent —
Phase 0's e2e only booted the app, so no DB fixture exists yet.

---

## 9. Execution order

| # | step | done when |
|---|---|---|
| 1 | `users` module + `serialize.ts` + `userRowToUser()` spec | mapper spec green |
| 2 | `sms` module, `SmsProvider` token, console provider | unit test: console provider records the code, never logs in prod mode |
| 3 | `otp.service.ts` + spec | OTP lifecycle spec green |
| 4 | `tokens.service.ts` + spec | payload/secret/expiry spec green |
| 5 | `auth.service.ts` + spec | auth spec green |
| 6 | guards + `@Roles()` / `@CurrentUser()` decorators | a probe route in the e2e app returns 403 for the wrong role |
| 7 | DTOs (class-validator, `whitelist`) | a bad body answers `VALIDATION_ERROR` |
| 8 | `auth.controller.ts` + cookie wiring + `@Throttle` | routes visible in `/docs-json` |
| 9 | `me` module (`GET/PATCH/DELETE /me`) | PATCH round-trips through the mapper |
| 10 | register modules in `app.module.ts` | `npm run dev` boots, `/docs` lists every new route |
| 11 | unit + e2e suites | `npm test` and `npm run test:e2e` green |
| 12 | README phase table + Swagger descriptions on every route | `/docs` self-explanatory |

Run after every step: `npm run lint`, `npm test`, `npx tsc --noEmit`.

---

## 10. Acceptance checklist (copy into the report)

- [ ] `npm install` · `npm run build` · `npm run lint` · `npm test` · `npm run test:e2e` all clean
- [ ] `prisma migrate status` clean (a new migration only if the schema changes — it should **not**: every Phase 1 table already exists)
- [ ] `npm run seed` still re-runnable (unchanged)
- [ ] `/docs` lists every route in §4 with request + response schemas
- [ ] e2e covers register → verify → login → `/me` → refresh → role denial
- [ ] Admin routes reject non-admins (probe route is enough for Phase 1; real `/admin/*` in Phase 4)
- [ ] No token, password, OTP code or secret appears in any log line
- [ ] `.env.example` unchanged unless a new variable is required (none planned)

---

## 11. Open decisions / risks

| # | risk | recommendation |
|---|---|---|
| R1 | Refresh-token rotation without a server-side store cannot revoke | rotate the cookie anyway, log rotations, and add a `refresh_tokens` table in Phase 4 — flag before adding, since §4's table list does not include it |
| R2 | `vet`/`pro` sign-up implies a pending **Service** row (web `signUp()` creates one) | Phase 1 stores only `role: reporter` + `licenseVerified: false` + `serviceId: undefined`; Phase 3 adds the row. Until then a `vet` sign-up has no listing — document it in the README |
| R3 | `DELETE /me` has no specified semantics | anonymise (blank `name`/`email`/`phone`, keep the id) so `cases.reporterId` and `reviews.authorId` FKs survive; confirm with the frontend dev |
| R4 | `email` is nullable + unique in the schema, and phone-only sign-up is not in the contract | keep email required at the DTO for Phase 1 (matches web `signIn`), revisit if phone-only auth is wanted |
| R5 | Throttler storage is in-memory | fine for a single instance; move to a shared store when the API scales out (Phase 4 hardening) |
| R6 | `ConsoleSmsProvider` returning the code in the response | gate strictly on `NODE_ENV !== "production"` and assert it in the e2e — this is the one place a demo convenience can become a production hole |

---

## 12. What was actually built (2026-10-09)

Executed in the order of §9. Everything in §1–§7 shipped, plus four additions that the
implementation turned out to need.

### Shipped

| Step | Delivered |
|---|---|
| 1 | `src/users/serialize.ts` (`userRowToUser`, `userRowToUserLite`) · `UsersService` (findByEmail/Phone, create, updateProfile, setPhoneVerified, clearOtps, anonymize) + specs |
| 2 | `src/common/env.ts` · `SmsProvider` interface + symbol token · `ConsoleSmsProvider` · `TwilioSmsProvider` (global `fetch`, no SDK) · `SmsService` + specs |
| 3 | `OtpService` — 6 digits via `crypto.randomInt`, 5-min TTL, 5 attempts, one live code per account, `IssuedOtp` has no `code` field at all + spec |
| 4 | `TokensService` · `src/auth/secrets.ts` (single source of truth for secrets/TTL/issuer) + spec |
| 5 | `AuthService` — register / verifyPhone / resendCode / login / refresh / logout + spec |
| 6 | `JwtStrategy`, `JwtRefreshStrategy`, `JwtAuthGuard`, `RefreshAuthGuard`, `RolesGuard`, `AdminGuard`, `@Roles()`, `@Public()`, `@CurrentUser()` |
| 7 | DTOs: `RegisterDto`, `LoginDto`, `VerifyPhoneDto`, `ResendCodeDto`, `UpdateMeDto`, `GeoPointDto` |
| 8 | `AuthController` — cookie wiring (`httpOnly`, `path=/auth`, `secure` in prod, `sameSite=lax`), rotation on refresh, per-route `@Throttle` |
| 9 | `MeController` + `MeService` — GET/PATCH/DELETE `/me` |
| 10 | `app.module.ts`: `AuthModule`, `MeModule`, `SmsModule`, `UsersModule` + **global** `JwtAuthGuard` and `RolesGuard` |
| 11 | 93 unit tests + `test/auth.e2e-spec.ts` (16 steps) + `test/global-setup.ts` (skips, never passes silently) |
| 12 | README phase table, route table, security model, layout |

### Verified locally

`tsc --noEmit` clean · `npm run lint` clean · `npm test` **93/93** · `npm run build` clean ·
server boots, `/docs` 200 with all 10 routes in the OpenAPI 3.0 document · `/me` without a token
→ `401 AUTH_UNAUTHORIZED` · `POST /auth/register {role:"admin"}` → `400 AUTH_ROLE_NOT_ALLOWED`
· bad body → `400 VALIDATION_ERROR` · tampered and expired tokens → `401` · `/docs-json` reachable.

**Not verified:** `prisma migrate status` and the e2e flow — `apps/backend/.env` (Supabase
credentials) does not exist on this machine, so the auth e2e suite correctly reports **16 skipped**
with the reason.

### Four additions beyond this plan

| # | Addition | Why |
|---|---|---|
| A1 | `AUTH_PHONE_TAKEN` (409) on duplicate phone | `phone_otps` is keyed by `userId`, so the OTP lookup is scoped by phone. Two accounts sharing one number would confirm the wrong account's code. |
| A2 | `AUTH_ACCOUNT_DELETED` (401) | `DELETE /me` needs a way to stop an already-issued access token. `UsersService.anonymize()` nulls `passwordHash`, which becomes the deletion marker — no schema change, and FK rows survive (R3). |
| A3 | `ThrottlerGuard` overridden in the e2e suite | The 16-step acceptance flow makes ~6 register calls, which the 5-per-10-minute limit would rightly reject. Rate limiting is asserted by its own decorators, not by that suite. |
| A4 | The exception filter now maps **raw driver failures** to `503 DB_UNAVAILABLE` | With `@prisma/adapter-pg`, a dead database arrives as a bare `Error` (`SASL: …`, `ECONNREFUSED`) carrying no Prisma code, so every data route was answering `500 INTERNAL_ERROR` — contradicting what the README has always claimed. 4 new unit tests pin it. |

### Bugs found and fixed along the way

1. `scripts/seed.ts` used `Prisma.TrustCheckId`, which does not exist as a namespace member — a
   pre-existing **type error that `nest build` never saw** (it excludes `scripts/`) and that would
   have broken `npm run seed` at compile time. Now `import type { TrustCheckId }`.
2. `@nestjs/common` 11 turned `InjectionToken` into a type alias, so the SMS provider token is a
   plain `Symbol`.
3. Nest 11's `Strategy` has no static `extractJwtFromAuthHeaderAsBearerToken`; the extractor lives
   on `ExtractJwt`.
