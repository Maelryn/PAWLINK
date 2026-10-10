# Research — Sabrine

Sabrine is a vet student: she already gives Katia the veterinary references and realistic animal test cases for the AI (see AI.md §4). This file is the research part.

You give PawLink **proof**. 40 of the 100 points (problem + impact) depend on showing the problem is real, that we talked to people who have it, and on numbers that aren't invented. You also make the demo data feel like real Algeria.

Put everything in `docs/research/` on a branch `data-sabrine`, then open a PR into `main`.

## 1. Facts with sources (`docs/research/facts.md`), due **Tue 13 Oct**

Find **8–10 real facts**, each with **the link where you found it**. If there's no source, don't use it. Ideas:
- How many stray dogs and cats there are in Algeria (or in Algiers, Oran…), and what cities do about them
- Animal rescue associations in Algeria and how they work (most use Facebook groups)
- How many vets / vet clinics there are per wilaya
- Livestock losses in the summer wildfires (Kabylie, Tizi Ouzou, Béjaïa, El Tarf)
- Rabies cases or vaccination campaigns
- How many Algerians use smartphones / the internet (for "people can use this")

Format per fact: `- Fact in one sentence. Source: [name](link), year`

## 2. Interviews (`docs/research/interviews.md`), due **Tue 20 Oct**

Organise the interviews (everyone does 1, see below) and collect them in one file. Same questions for everyone:
1. Tell me about the last time you found an injured or lost animal. What happened?
2. Who did you call or contact? How long did it take to get help?
3. What was the hardest part?
4. Have you seen fake or exaggerated posts? How do you know which ones are true?
5. Would you use an app that shows hurt animals near you on a map? What would stop you?
6. (vets / shelters) Would you pay a small monthly fee to appear first and receive appointments?

Per interview: **first name only, role (rescuer / vet / shelter / pet owner), city, date**, 5 lines of answers, and **1 short quote** we can use in the video. Always ask permission to quote them. No phone numbers or full names.

Then write a summary of **the 3 things that came up the most**. That goes in the pitch.

## 3. Demo data (`apps/web/lib/mock/data.ts` and the backend seed), due **Tue 20 Oct**

Make the demo look real, **without pretending to be real businesses**:
- Real wilayas and neighbourhoods, realistic positions (not in the sea)
- Common Algerian first names, invented clinic / shop names ("Clinique Vétérinaire El Amel", not a real one with its real phone number)
- Phone numbers in the format `+213 5XX XX XX XX` with `00` endings, so they're obviously fake
- Reports with descriptions that sound like real people (mix of French, Arabic and some Darija)

Send your edits as a list in the PR, or edit the files directly on your branch. Maelryn + backend copy them into the seed.

## 4. Impact numbers (`docs/research/impact.md`), due **Sat 24 Oct**

One page, with every number linked to a fact from step 1:
- **Who it helps:** rescuers, pet owners, farmers in wildfire zones, vets and shops
- **How many:** a realistic first target (e.g. "Algiers + Tizi Ouzou, 3 associations, 500 users in 3 months"). **No made-up big numbers**, the judges punish that
- **How it pays for itself:** PawLink Pro (2 900 DA/month for vets and shops). How many paying businesses cover the server costs
- **What happens after October:** the next 3 months

## For everyone

Each team member (all 6):
1. **Interview 1 real person** with the questions above, and send the notes to Sabrine by **Tue 20 Oct**
2. **Test the live site on your own phone** every few days and send bug screenshots in the group (which page, what you tapped, what went wrong)
3. Write **your own honest line** for the submission: what you actually built (by **27 Oct**)
