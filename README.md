# PawLink

Animal rescue, care and adoption platform for Algeria.

| Folder | What |
|---|---|
| `apps/web/` | Next.js website (see `web/README.md`) |
| `apps/mobile/` | Expo SDK 57 + React Native app (see `docs/MOBILE_PLAN.md`) |
| `apps/backend/` | NestJS + Prisma API (work in progress on branch `backend1`) |
| `apps/Ai/` | AI notes (the AI module lives in the backend, see `docs/tasks/AI.md`) |
| `brand/` | Logo (PNG + SVG, light & dark) |
| `docs/` | `FRONTEND_PLAN.md`, `MOBILE_PLAN.md`, `BRAND_AND_ASSETS.md` (AI prompts), `TEAM_HANDOFF.md`, **`tasks/` (who does what, with dates)** |

```bash
cd apps/web
npm install
npm run dev
```

Demo accounts (mock mode): `amine@pawlink.dz` (volunteer), `yasmine@pawlink.dz` (reporter), `dr.taleb@pawlink.dz` (vet), `ines@pawlink.dz` (admin), password `pawlink2026`.
