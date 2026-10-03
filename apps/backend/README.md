# PawLink — Backend (NestJS)

The API the PawLink web + mobile apps consume. Built against **`../docs/TEAM_HANDOFF.md`** and
**`../docs/BACKEND_PROMPT.md`** — response shapes must match `../apps/web/lib/types.ts`
field-for-field, because the frontend generates its typed client from this service's Swagger.

**Status: Phase 0 — Foundation** ✅ · Phase 1 (auth) · Phase 2 (cases/trust/AI/realtime) · Phase 3 (marketplace) · Phase 4 (admin/hardening)

| Phase | What |
|---|---|
| 0 ✅ | NestJS scaffold · Swagger · Prisma schema (15 tables + PostGIS) · error envelope · health · seed |
| 1 ⬜ | register → OTP → login → JWT + refresh cookie · guards · SMS providers |
| 2 ⬜ | cases + bbox query + trust pipeline + `/ai/analyze` + Socket.IO |
| 3 ⬜ | adoptions, services, reviews, bookings, zones, notifications |
| 4 ⬜ | admin, moderation queues, hardening |

## Run it

```bash
npm install
# put your real Supabase connection strings in .env (see .env.example), then:
npm run prisma:migrate     # creates tables + PostGIS + indexes
npm run seed               # demo scenario from apps/web/lib/mock/data.ts
npm run seed:admin -- --email you@pawlink.dz --password <secret>   # admin (never via signup)
npm run dev                # http://localhost:4000
```

- Swagger UI → <http://localhost:4000/docs> · machine-readable → `/docs-json`
- Health → <http://localhost:4000/health> (`status: ok|degraded`, `db: up|down`)

## Test

```bash
npm run test       # unit (error envelope, …)
npm run test:e2e   # boots the app: /health, /docs-json, error envelope
npm run lint
```

## Environment

Copy `.env.example` → `.env`. The API must start with **only** the two database URLs set —
`AI_PROVIDER=mock`, `SMS_PROVIDER=console`, no Cloudinary ⇒ everything else degrades gracefully
(uploads answer a typed `UPLOADS_NOT_CONFIGURED` error), so the demo never needs paid services.

## Layout

```
prisma/schema.prisma   15 tables · PostGIS geography columns (trigger-maintained) · GIST indexes
src/main.ts            Swagger + CORS + configureApp()
src/setup.ts           pipes/filters — shared by server and tests
src/common/filters     { statusCode, message, code } global error envelope
src/common/prisma      PrismaService (never crashes the boot; 503 DB_UNAVAILABLE instead)
src/health             GET /health
src/shared/types.ts    verbatim copy of apps/web/lib/types.ts — the response contract
src/seed/data.ts       verbatim copy of apps/web/lib/mock/data.ts — the demo scenario
scripts/seed.ts        ports the demo scenario into PostgreSQL (re-runnable)
scripts/create-admin.ts the ONLY way an admin account is created
```

## Contract rules that are not negotiable

1. Never trust the client — roles, moderation, trust, EXIF, rate limits are server-side.
2. Response fields match `src/shared/types.ts` exactly.
3. No diagnosis, ever; every AI answer carries a veterinarian disclaimer.
4. Admin exists only via `seed:admin`; every `/admin/*` route checks the JWT role.
5. Adoption phone numbers are revealed only when a request is `accepted`.
