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

## 5. The website is ready for the API (from Maelryn)

The website now talks to the API through `apps/web/lib/api/` and switches each part on with an env var, so nothing breaks while a phase is being built:

```
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_API_FEATURES=auth            # add cases,uploads,ai when Phase 2 is live
```

- **auth (Phase 1) is wired**: login, register → SMS code (the `code` you return outside production is shown as "Test code" so we can sign up without SMS), verify-phone, resend-code, refresh cookie on load, logout, `PATCH /me`, `DELETE /me`. Your error codes are shown as real messages (`AUTH_INVALID_CREDENTIALS`, `AUTH_EMAIL_TAKEN`, `AUTH_OTP_INVALID`, `RATE_LIMITED`…).
- **cases (Phase 2) is pre-wired** to the routes in your `PHASE2_PLAN.md` §5: `GET /cases` (polled every 20 s), `POST /cases`, `/help`, `/confirm`, `/flag`, `PATCH /cases/:id/status`, `PATCH /admin/cases/:id/moderation`. When they exist, we just add `cases` to the env var.

### Answers to your open questions (PHASE2_PLAN §12)

- **R1 photo probe: yes, option A works for the web.** The website sends the original file to `POST /uploads/probe` (multipart field `file`) and gets `{ probeId }`, then uploads to the URL from `POST /uploads/signature`, then sends `photos` + `probeIds` in `POST /cases`. Signature response the website expects: `{ url, fields }` (`url` = where to POST the file, `fields` = the signed form fields). Storage answer read: `secure_url` (Cloudinary). If you prefer Supabase Storage, keep the same `{ url, fields }` shape and tell me.
- **R9 `GET /cases`: public.** Browsing the map is open to everyone; only actions need an account.

### Small things the website needs from Phase 2

1. **Resolving a case:** the reporter and the people helping on that case must be able to `PATCH /cases/:id/status` → `resolved` (not only volunteer/vet/admin). The website has a "Mark as resolved" button for them.
2. **Nearby helpers:** when a public case is created, create a `nearbyCase` notification for the helpers in `ai.suggestedHelpers` (the website does this in demo mode and the video shows it).
3. **Demo reports:** when `reporterOnSite: false`, the `onSite` trust check must be `false` (it's a judge/tester using the demo position), so it can never be "verified".

### Before deploying the API (important for the judges)

- **Refresh cookie across domains:** the website is on Vercel and the API will be on another domain, so in production the refresh cookie needs `sameSite: 'none'` + `secure: true`. With `lax` the browser won't send it from Vercel, and users get logged out on every reload.
- **CORS:** add the Vercel production domain to `CORS_ORIGINS`.
- **SMS for the jury:** with `NODE_ENV=production` and no real SMS provider, nobody can finish sign-up. Either return the code in a demo build (an env flag like `OTP_DEMO=true`), or the judges only use the demo accounts. Tell me which one.
