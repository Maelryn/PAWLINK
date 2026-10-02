# PawLink — Brand, Prompts & Assets

## 0. What already exists in the code

| Asset | Where | Notes |
|---|---|---|
| **Logo mark** (paw whose main pad is a map pin) | `web/components/brand/Logo.tsx` (`LogoMark`, `AppIcon`, `Wordmark`) | Pure SVG: sharp at any size, recolorable, animatable |
| **App icon / favicon** | `web/app/icon.svg` | iOS squircle, blue → indigo gradient with a pink glow |
| **3D animals & objects** | `web/public/3d/*.png` | Microsoft Fluent Emoji 3D (MIT license). 55 files: dog, cat, sheep, goat, cow, horse, **camel**, **donkey**, chicken, owl, fire, ambulance… |
| **Case & adoption photos** | `web/public/mock/*.jpg` | Unsplash (free license), local so the demo works offline |
| **Map** | OpenFreeMap vector tiles (free, no key), recolored to an Apple Maps palette | `web/components/map/mapStyle.ts` |

**Licensing rules (important for a public demo):**
- ❌ **SF Pro** must not be self-hosted on a website (Apple's license covers mockups only). The site uses the system font stack, so Apple users see real SF Pro, with **Inter** for everyone else and **IBM Plex Sans Arabic** for Arabic.
- ❌ **Apple Memoji/Animoji** can't be used. We use **Fluent 3D** today, plus our own generated characters (prompts below).
- ✅ You *can* use SF Pro and the Apple Figma kit for **pitch slides and mockups**.

---

## 1. The logo: AI prompts

The coded SVG logo is the **source of truth** (it's already on the site). Use these prompts to get a **hero / 3D render version** for slides, the OG image and the App Store-style icon.

### Prompt A: Liquid Glass app icon (main, the "wow" one)
```
A premium iOS 26 "Liquid Glass" app icon for an animal-rescue app named PawLink.
Rounded squircle icon, centered on a soft light-grey background with gentle shadow.
The icon body is translucent frosted glass with real refraction and a bright specular
rim light on the top-left edge, tinted with a smooth gradient from electric blue
(#2F8CFF) to indigo (#5E5CE6) with a soft pink glow (#FF2D78) bleeding in the
bottom-right corner. Inside, floating slightly above the glass: a glossy, softly
inflated white 3D paw print. Its large main pad is shaped exactly like a map location
pin (teardrop pointing down, with a round hole in the middle). Four rounded toe beans
above it in a gentle arc. Subtle inner glow, clean studio lighting, ultra-detailed,
Apple design language, minimal, no text, no letters, 1024x1024, perfectly centered,
front view.
```

### Prompt B: Glass tile for the hero / keynote slide (like the iOS 16 "16" tile)
```
A large translucent frosted-glass rounded square tile floating in bright airy white
space, Apple keynote aesthetic. Inside the glass, a paw-print symbol whose main pad
is a location pin, rendered as glossy liquid glass with an iridescent gradient
(blue #2F8CFF → indigo #5E5CE6 → pink #FF2D78). Soft pastel color halos bleed behind
the tile. Around it, slightly out of focus, cute glossy 3D animal heads (a puppy, a
kitten, a lamb, a baby camel) floating at different depths with shallow depth of field.
Extremely clean, soft shadows, 16:9, 4K, no text.
```

### Prompt C: Flat vector mark (to vectorize / print / stickers)
```
Minimal flat vector logo mark: a paw print whose main pad is a map location pin shape
with a round hole, four rounded oval toe beans above it in an arc, bold simple
geometry, perfectly symmetrical, single solid color white on a #3B6CF6 rounded
square, Apple-like simplicity, no gradient, no text, centered, SVG style.
```

### Prompt D: Dark-mode icon variant
```
Same PawLink app icon (paw print with a location-pin main pad) in iOS 26 dark mode:
deep near-black glass squircle with a subtle blue-to-indigo inner glow, the paw
symbol in luminous glass with a blue (#0A84FF) to pink (#FF375F) gradient, crisp
specular rim, dark grey background, 1024x1024, no text.
```

**Tools:** ChatGPT image (GPT-image), Midjourney v7 (`--style raw --ar 1:1`), or Ideogram. Generate 8–12 variants and keep the 2 best.

---

## 2. Custom 3D mascot cast (our own "Animoji")

Same template for every animal, so the set looks consistent. Generate them **in one session**.

### Template
```
A cute 3D character head of a [ANIMAL], glossy stylized 3D emoji avatar style,
smooth rounded shapes, big expressive shiny eyes with highlights, soft subsurface
fur shading, [EXPRESSION], three-quarter view, soft studio lighting from top-left,
pure white background, centered, head only, no body, no text, high-quality 3D render,
Pixar-like simplicity, part of a consistent set of animal avatars.
```

| ANIMAL | EXPRESSION | Used for |
|---|---|---|
| golden street puppy (Algerian village dog, sandy fur) | happy, tongue out | hero, adoption |
| tabby street cat from Algiers | curious, one ear tilted | hero, species picker |
| fluffy white Ouled Djellal sheep | calm sleepy smile | livestock |
| baby dromedary camel | playful, long eyelashes | livestock, Sahara |
| little grey donkey | gentle, ears up | livestock |
| goat with small horns | cheeky wink | hero |
| brown Barb horse | proud, gentle | livestock |
| owl | wise, wide eyes, tiny glasses | **AI mascot ("PawLink AI")** |
| puppy with a small bandage on its head | brave, slightly sad | injured / report flow |
| kitten wrapped in a soft blanket | relieved, safe | rescued / success screen |

After generating:
1. Remove the backgrounds with **Photoroom** or **remove.bg**
2. Export **WebP, 512×512, transparent**
3. Drop them in `web/public/3d/` with the same file names (`dog.png`, `cat.png`, …) and the whole site uses them automatically

---

## 3. Scene illustrations (landing, pitch, social)

Template:
```
Soft 3D illustration in a clean Apple-keynote style: [SCENE]. Pastel colors, soft
global illumination, rounded stylized shapes, lots of white space, gentle depth of
field, hopeful mood, no text, 16:9.
```
Algeria-specific scenes:
- `a tiny 3D diorama of the Kabylie mountains with olive trees, a small wildfire in the distance, glossy map pins with animal avatars floating above the villages`
- `a volunteer in a Civil Protection-style orange vest gently carrying a goat away from smoke, dusk light`
- `a small white pickup truck on a mountain road carrying rescued sheep, sunrise over the Djurdjura`
- `a glowing friendly AI orb scanning a photo of a cat, translucent UI cards floating around it`
- `the white Casbah of Algiers at golden hour with a cat sitting on a terrace, glass map pin above it`
- `a baby camel and a shepherd in the Sahara near Ghardaïa, soft dunes, glass location pin`

---

## 4. Demo-day pitch slides (like the green "AI sidekick" reference)

Style: each slide is one big headline plus one real screenshot in an iPhone/MacBook frame (Apple Figma kit), on our gradient.

| Slide | Headline | Screen |
|---|---|---|
| 1 | **Every animal. One link away.** | Landing hero |
| 2 | **Report in 30 seconds.** | Report flow (photo step) |
| 3 | **AI triage. Never a diagnosis.** | AI reveal "Urgent" |
| 4 | **Built for the worst days.** | Map in emergency mode (Kabylie) |
| 5 | **Everyone can help.** | "I can help" sheet + dashboard |
| 6 | **A second chance, documented.** | Adoption profile |
| 7 | **From kittens to camels.** | Livestock species picker |

Slide background prompt:
```
Abstract soft gradient background, electric blue #2F8CFF to indigo #5E5CE6 with a
pink #FF2D78 glow in one corner, subtle liquid-glass light refraction streaks,
very clean, Apple keynote style, 16:9, 4K, no text, no objects.
```

---

## 5. Fonts, icons, motion

| Use | Choice |
|---|---|
| UI Latin | system (SF Pro on Apple) → **Inter** |
| Arabic | system (SF Arabic on Apple) → **IBM Plex Sans Arabic** |
| UI icons | **Lucide** |
| Illustrative icons | Fluent 3D (`/public/3d`) |
| Motion | `motion` (springs, layout), Lenis (smooth scroll), CSS keyframes (pulse, shimmer) |
| Extra animated assets (optional) | LottieFiles: "paw loading", "success check", "fire" |
