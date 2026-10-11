# Backend — Mohamed + Aymen

Your full spec is already in `docs/BACKEND_PROMPT.md` on `backend1`, and it's very good. This file only adds **dates, the order of work, and the few things the website has that the prompt doesn't**.

## 1. Order (the core first, polish later)

The judges' main test is "report an animal, then see it on the map". So **Phase 2 comes before the polish of Phase 1**.

| Due | What | Notes |
|---|---|---|
| **Sun 11 Oct** | Phase 1: register, login, refresh, logout, `GET/PATCH/DELETE /me`, guards | **SMS: keep the `console` provider only** (code shown in the response outside production). Twilio is "after October" |
| **Tue 13 Oct** | Phase 2 core: `POST /cases`, `GET /cases?bbox`, `GET /cases/:id`, `PATCH /cases/:id/status`, `POST /cases/:id/help`, photo uploads | Use **Supabase Storage** instead of Cloudinary (one less account). Keep `/uploads/signature` returning a signed upload URL |
| **Wed 14 Oct** | Phase 2 rest: trust pipeline, confirm/flag, moderation, `POST /ai/analyze` wired to **Katia's** `AIProvider`. **API online** | Realtime: if Socket.IO costs more than half a day, skip it. The website will re-fetch every 10 s |
| **Tue 20 Oct** | Phase 3: adoption, requests + phone reveal, services, reviews + reply, bookings, notifications, zones | |
| **Sat 24 Oct** | Phase 4: admin, stats, **Pro** (below), README, Swagger complete. **Freeze** | |

Push every evening to `backend1` (or `backend-*` branches) and tell the group which endpoints are live. The website switches each endpoint from fake to real as soon as it works.

## 2. Missing from BACKEND_PROMPT (the website already uses these)

**a. Business sign-up.** The website has 4 sign-up choices: `reporter | volunteer | vet | pro`.
```
POST /auth/register { name, email, password, phone, city,
                      role: "reporter" | "volunteer" | "vet" | "pro",
                      business?: { name: string; type: ServiceType } }
```
- `volunteer` gets the `volunteer` role. `reporter`, `vet` and `pro` start as `reporter`.
- For `vet` / `pro`: also create a `Service` with `ownerId = user.id`, `status: "pending"` (vet → `type: "vet"`, pro → `business.type`), and set `user.serviceId`. An admin approves it (`PATCH /admin/services/:id`). Approving a **vet** service also sets `user.role = "vet"` and `licenseVerified = true`.

**b. PawLink Pro** (demo payment, no real money):
```
POST /me/pro { plan: "pro" | "plus", period: "month" | "year", promoCode?: string }
  → 200 { user }  user.pro = { plan, since, until }   (until = now + 30 or 365 days)
```
- Allowed only if `user.serviceId` exists. Sets `service.pro = true` and creates a `proActive` notification.
- Demo rule: `promoCode === "DEMODAY"` → free. Otherwise accept it and add `"demo": true` to the response (real payment = Chargily later, write that in the README).
- `GET /services` sorts `pro` services first. Pro features the server must check: booking requests and replying to reviews only work for Pro businesses (`403 PRO_REQUIRED` otherwise).

**c. User fields** the website shows: `city, bio, photo, available, helpTypes, phone, serviceId, pro, createdAt` must be accepted by `PATCH /me` (except `pro`, `role` and `serviceId`).

**d. The "My reports" tab:** `GET /me/cases` returns the cases I reported.

## 3. Shapes

Every response must match `apps/web/lib/types.ts` **exactly** (field names and enums). If you need to change a shape, say so in the group first. Changing it silently breaks the website.

## 4. Done checklist

- [ ] Seed has the demo accounts (`*@pawlink.dz` / `pawlink2026`), one per role, plus admin
- [ ] CORS allows `http://localhost:3000` and the Vercel domain
- [ ] Deployed and reachable from the internet (send the URL in the group)
- [ ] `/docs` shows every endpoint
- [ ] `apps/backend/README.md`: how to run, env vars, seed, what's not finished
- [ ] `npm run build`, lint and tests pass

## 5. The website is connected to the API (from Maelryn)

The website talks to the API through `apps/web/lib/api/` and switches each part on with an env var, so the live site never breaks while something is being built:

```
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_API_FEATURES=auth,cases,uploads
```

| Part | Status on the website |
|---|---|
| **auth** (Phase 1) | ✅ login, register → SMS code (the dev `code` is shown as "Test code"), verify-phone, resend-code, session restored from the refresh cookie, logout, `PATCH /me`, `DELETE /me`, error codes shown as real messages |
| **cases** (Phase 2) | ✅ `GET /cases` (refreshed every 20 s), `POST /cases`, `/help`, `/confirm`, `/flag`, `PATCH /cases/:id/status`, `PATCH /admin/cases/:id/moderation` |
| **uploads** (Phase 2) | ✅ `POST /uploads/probe` (original file), then direct Cloudinary upload with your `{ cloudName, apiKey, folder, timestamp, signature }`, then `photos` + `probeIds`. If you answer `UPLOADS_NOT_CONFIGURED`, the report is still sent without the photo |
| **AI** | ⏳ apps/Ai service (Katia). Until it's connected, the website runs its rule-based triage and sends it as the `triage` baseline |

### Still needed from the API

1. **Resolving a case:** the reporter and the people helping on that case should be able to set `resolved` (today it's volunteer / vet / admin only, so the website only shows the button to them when the API is on).
2. **Nearby helpers:** when a public case is created, a `nearbyCase` notification for nearby available volunteers / vets (the website does it in demo mode and the video shows it).
3. **Demo reports:** when `reporterOnSite: false`, the `onSite` check must be `false` so it can never be "verified".
4. **Cloudinary credentials** in the API env, otherwise reports have no photo.

### Before deploying the API (important for the judges)

- **Refresh cookie across domains:** the website is on Vercel and the API on another domain, so in production the refresh cookie needs `sameSite: 'none'` + `secure: true`. With `lax` the browser won't send it from Vercel and users are logged out on every reload.
- **CORS:** add the Vercel production domain to `CORS_ORIGINS`.
- **SMS for the jury:** with `NODE_ENV=production` and no real SMS provider nobody can finish sign-up. Either return the code in a demo build (an env flag like `OTP_DEMO=true`), or the judges only use the demo accounts. Tell me which one.
- Send me the API URL when it's online and I connect the live website to it.
