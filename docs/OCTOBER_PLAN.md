# PawLink — October plan (Thirduni team project)

**Submission:** platform opens **Thu 15 Oct** (submit a draft that day), closes **Sat 31 Oct 23:59 Algiers**.
**Our own deadline: Fri 30 Oct.** Nothing gets uploaded on the 31st.

## Our one sentence (everyone uses this exact sentence)

> In Algeria, people who find an injured or lost animal don't know who to call, so PawLink connects them in minutes with nearby volunteers and vets.

Everything in the demo serves this sentence. Adoption, services and Pro are "what comes next", not the main story.

## The core loop (this must work for real, end to end, on the live link)

1. Sign up / log in (real accounts in the database)
2. Report an animal: photo + position. The photo is uploaded and **analysed by the real AI** (Gemini Flash), which returns species, urgency and first-aid tips and never gives a diagnosis.
3. The report appears **on the map for everyone**, on any phone or computer
4. A volunteer or vet taps "I can help", and the case moves to *in progress*, then *resolved*
5. Admin can hide fake reports

Adoption, services, reviews and Pro come after the core loop works, connected to the same database.

## Architecture (decided)

| Piece | Choice |
|---|---|
| Web | Next.js (`apps/web`), on Vercel |
| API | NestJS + Prisma (`apps/backend`, Mohamed's foundation), on Vercel |
| Database | Supabase Postgres (Mohamed's Prisma schema and migrations) |
| Photos | Supabase Storage |
| AI | Gemini Flash, called from the API, behind the safety rules layer |
| Mobile | The website works as an installable app (PWA). The native Expo app is **paused** and listed in "what happens next" |

Secrets live only in Vercel / Supabase settings and in local `.env` files. Never in the repo.

## Timeline

| Dates | Goal |
|---|---|
| **9–11 Oct** | Agree on the sentence. Create the Supabase project and Gemini key. Merge `backend1`. Put the current website online |
| **12–15 Oct** | Accounts, reports with photo upload, real AI, cases on the shared map. **Submit a draft on the 15th** |
| **16–22 Oct** | Help flow, admin moderation, notifications. Adoption and services on real data. Interviews done |
| **23–27 Oct** | Feature freeze on the 27th. Fix bugs on real phones. README, roles, tech stack, next steps |
| **28–29 Oct** | Record the demo video, make the deck |
| **30 Oct** | Final upload. Check every link in a private window, logged out |

## Tasks

Each task is small, has an owner and a date. Tick it when it's done and push.

### Maelryn: frontend, API endpoints, AI, deploy
- [ ] Put the website on Vercel (11 Oct)
- [ ] Auth, cases, photo upload, AI triage endpoints, connected to the web (15 Oct)
- [ ] Help flow, moderation, notifications (20 Oct)
- [ ] Adoption and services on real data (24 Oct)
- [ ] Final README (27 Oct)

### Mohamed: backend and data
- [ ] Create the Supabase project, run the migrations and the seed, and send the connection string **privately** (not in git) (10 Oct)
- [ ] Turn on Swagger at `/docs` (11 Oct)
- [ ] Write the backend part of the README: how to run it, the env variables, the seed (14 Oct)
- [ ] Write one e2e test for "create a case" and one for "log in" (20 Oct)
- [ ] Check the seed data looks real: Algerian cities, real-looking names, no "Lorem" (20 Oct)

### Aymen: users, testing, video
- [ ] **Interview 5 real people** (rescuers from Facebook rescue groups, 1 vet, 1 shelter). Ask: what happened the last time you found a hurt animal? Who did you call? How long did it take? Write 1 short note per person in `docs/interviews.md`, with first name and city only (14 Oct)
- [ ] Find 3 real facts about stray animals or rescue in Algeria, **with the source link**, in `docs/facts.md` (14 Oct)
- [ ] Test the live site on 3 different phones (Android and iPhone) and open a GitHub issue for each bug, with a screenshot (from 16 Oct, then every 3 days)
- [ ] Record the raw screen footage for the video, following the script (28 Oct)
- [ ] Make the 8-slide PDF deck (29 Oct)

### Everyone
- [ ] Write your own honest line for "Team members and roles" (27 Oct)
- [ ] 30 Oct: open the live link, the repo and the video **in a private window, logged out**

## Demo video (3 min, the product first)

| Time | What we show |
|---|---|
| 0:00–0:20 | A phone opens PawLink and reports an injured dog with a photo. No intro slides |
| 0:20–0:45 | The problem in one sentence, plus one interview quote and one fact |
| 0:45–2:00 | The AI triage, the case on the map, a volunteer on a 2nd phone taps "I can help", the case is resolved |
| 2:00–2:30 | Trust checks against fake reports (2 km rule, real photo), admin moderation |
| 2:30–3:00 | Adoption and services. How it keeps going (PawLink Pro for vets and shops). What comes next |

## Submission checklist (items 1–6 are required, or we are not scored)

1. [ ] Name + one-line summary (20 words max)
2. [ ] Description (150 words max, says what it **does**, not the tech)
3. [ ] Live demo link (Vercel)
4. [ ] **Public** GitHub repo with a README: what it is, how to run it, who built what
5. [ ] Demo video, 2–4 min, **unlisted** (not private) on YouTube
6. [ ] Team members + honest roles
7. [ ] Tech stack, including the AI tools we used to build it (Claude Code, Gemini)
8. [ ] What happens next (100 words max)
9. [ ] Optional: 8-slide PDF deck
