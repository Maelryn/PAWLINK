# PawLink — who does what (Thirduni final project)

**Deadline:** Sat 31 Oct 23:59 (Algiers). Platform opens Thu 15 Oct, and we submit a draft that day.
**Our own final deadline: Fri 30 Oct.**

**Our sentence:** *In Algeria, people who find an injured or lost animal don't know who to call. PawLink connects them in minutes with nearby volunteers and vets.*

## The product judges will use (the live website)

1. Sign up / log in
2. **Report an animal**: photo + position (must be in Algeria, within 2 km). The **AI** reads the photo and says how urgent it is, gives first-aid tips and always says to see a vet
3. The report shows **on everyone's map**
4. A volunteer or vet taps **"I can help"**, then *in progress*, then *resolved*
5. **Adoption**: post a pet (max 3 real photos, admin approves), people send requests, and the phone number is shown only when accepted
6. **Services**: vets, shelters and shops with reviews, replies and appointments
7. **Admin**: hides fake reports, approves adoptions and businesses
8. **PawLink Pro**: businesses pay to appear first and get appointments (demo payment)

The website already does all of this **on fake data**. Our job now is to make it **real**.

## Team

| Who | Part | Task file |
|---|---|---|
| Maelryn | Website: connects every screen to the API, live link | — |
| Mohamed + Aymen | Backend API (NestJS + Supabase) | [BACKEND.md](BACKEND.md) |
| Katia | Data/AI: triage with Gemini (description first, photo checks), safety rules, evaluation | [AI.md](AI.md) |
| Sabrine | Vet references + AI test cases (with Katia), research: facts, interviews, demo data, impact | [DATA.md](DATA.md) |
| Naila → Aymen | Mobile app design, then build | `docs/MOBILE_PLAN.md` |
| **Everyone** | Interview 1 real person, test on your phone, write your role line | [DATA.md](DATA.md#for-everyone) |

## Dates (the same for everybody)

| Date | Done means |
|---|---|
| **Sun 11 Oct** | Login / sign-up works through the API. AI returns a real answer from a test script |
| **Tue 13 Oct** | Reports + photo upload + map + "I can help" through the API. Facts file done |
| **Wed 14 Oct** | AI plugged into reports. API online. Website uses real data for the core flow |
| **Thu 15 Oct** | **Draft submitted** |
| **Tue 20 Oct** | Adoption, services, reviews, appointments real. 5 interviews written |
| **Sat 24 Oct** | Admin, notifications, Pro real. **Feature freeze**: only bug fixes after this |
| **25–28 Oct** | Bug hunt on real phones. README, roles, tech stack |
| **29–30 Oct** | Video + slides. Final upload. Check every link logged out |

## Rules for everyone

- **Branch per person, PR into `main`.** Never push straight to `main`, never force-push, never edit someone else's files without asking
- **No secrets in git.** Keys go in `.env` (gitignored) and in Vercel / Supabase settings. Send keys in private, never in the group
- Done = it works **on the live link**, not just "on my PC"
- Stuck for more than 2 hours? Say it in the group. Nobody gets blamed for asking
- AI tools are allowed (Thirduni says so). We list them in the submission
