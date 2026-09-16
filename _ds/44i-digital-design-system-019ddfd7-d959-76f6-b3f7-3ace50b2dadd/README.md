# 44i Digital — Design System

> White-label digital fulfillment for TV stations, radio groups, media publishers, and agencies.
> Confident. Direct. Built for B2B partners who need to look brilliant in front of their clients.

---

## About

**44i Digital** is a white-label digital marketing fulfillment company. Our partners are TV stations, radio groups, newspapers, magazines, and advertising agencies. They sell digital services to their advertisers under their own brand — and we build, deliver, and report on every campaign behind the scenes.

We're **invisible by design**. The customer of every partner-facing surface is a sales VP, agency principal, broadcast group GM, or publisher executive deciding whether to add a digital revenue line to their business. Our job is to make that decision feel obvious.

The brand is **20+ years old, Inc. 5000 recognized, headquartered in the upper Great Plains, serving all 50 states.** It is a stable, growing, partner-obsessed B2B service business — and the design system has to feel that way.

### Source materials

We were given the four logo lockups in `uploads/`:

- `44iDigital.svg` — full color lockup (44 mark + "iDIGITAL" wordmark)
- `44iDigital_Icon.svg` — standalone "44" mark (mono)
- `44iDigital_OnBlack.svg` — full lockup formatted for dark surfaces
- `44iDigital_OnBlue.svg` — full lockup formatted for blue (brand) surfaces

Plus the full marketing-site copy at `uploads/44i-full-site-copy.md` (six interior pages: Why Choose Us, Agencies, TV/Radio Broadcasters, Media Publishers, Markets We Serve, What We Offer).

---

## Index

```
/
├── README.md              ← you are here
├── SKILL.md               ← agent skill manifest
├── colors_and_type.css    ← all design tokens (CSS variables)
├── assets/                ← logos in every standard variant
├── preview/               ← design-system cards (registered for review)
└── ui_kits/
    └── website/           ← marketing site recreation (index.html + JSX)
```

Read `colors_and_type.css` first — every token used downstream is defined there.

---

## CONTENT FUNDAMENTALS

The 44i voice is **authoritative, direct, and benefit-forward**. We are senior B2B operators talking to senior B2B operators. Every sentence earns its place. We sell with concrete numbers, real consequences, and zero buzzwords.

The audience is **partners**, not end consumers. A "partner" is a TV station GM, a radio group sales director, a newspaper publisher, an agency owner. We never address their advertisers directly — we always speak about *their clients* and what *their clients* need.

### Person & address

- **"You" = the partner.** Always. ("Your team," "your sales reps," "your clients," "your market.")
- **"Their clients" = your partner's advertisers.** Never "our clients" — that's a brand violation. We don't have a direct relationship with the advertiser.
- **"We" = 44i.** First-person plural, never "I."
- **Avoid "us" in CTAs** unless the action is genuinely conversational. Prefer **"Book a free demo"**, **"See the program"**, **"Get the partner overview"**.

### Voice principles

| Principle | What it sounds like |
|---|---|
| **Specific over general** | "30–50% margin" — not "great margins". "All 50 states" — not "nationwide". "20+ years" — not "decades". |
| **Consequence over feature** | "Every referral is a risk." — not "We give you fulfillment." |
| **Direct over polite** | "Your clients are going digital. Make sure they stay with you." |
| **Confident over hedged** | "We don't disappear." — not "We strive to be available." |
| **Concrete over abstract** | "$500K+ per year in salary alone." — not "significant overhead." |

### Sentence shape

Short. Often a fragment. A period, a beat, then the punch.

> *"Your invisible digital department. Fully operational from day one."*
> *"You sell the service. You set your price. We build it and deliver it. You keep the margin."*
> *"It's that clean."*

### Casing

- **Headlines & H1/H2:** sentence case, ending with a period. Periods at the end of headlines are **on-brand** — they signal finality and confidence.
- **Eyebrows / overline labels:** Title Case OR sentence case (NOT all caps in the marketing context — eyebrows are conversational, like *"The 44i Difference"* or *"Why Partners Choose Us"*). Tracked tighter than display caps.
- **UI labels & nav:** sentence case ("Book a free demo", "Partner portal").
- **Buttons:** sentence case, with a **trailing arrow `→`** on primary CTAs ("Book a Free Demo →").
- **Phone number:** always formatted **`605.271.7321`** (periods, not dashes or parens).

### Punctuation

- **Em dash —** used liberally for rhythm and emphasis. (See basically every paragraph in the source copy.)
- **Periods** end headlines. This is a brand signature.
- **Slashes** for paired-but-distinct concepts: *OTT / CTV*, *TV / Radio Broadcasters*, *Strategy / Design / Build*.
- **Ampersand `&`** in compact contexts ("Programmatic & Advanced Targeting").
- **Avoid exclamation points** entirely.
- **Avoid ellipses** in marketing copy.

### Numbers & names

- **"44i" or "44i Digital"** — never "44i Digital, Inc." in flowing copy unless legal context. Never "Forty-Four Eye".
- **Percentages with hyphens:** `30–50%`, `2–3 weeks` (en-dash for ranges, em-dash for breaks).
- **Stats are pillars.** When we have a number, lead with it: *"500+ campaigns fulfilled."* *"All 50 states."* *"20+ years in digital marketing."*
- **Dollar figures** are concrete: `$500K+ per year in salary alone`, `$200K in digital revenue`.

### Vocabulary — words we use

**Partnership.** partner, program, partnership, dedicated strategist, account strategist, partner portal, onboarding, training.
**Brand protection.** white-label, behind the scenes, invisible, under your brand, branded as yours, your invisible digital department.
**Substance.** fulfillment, deliverables, reporting, performance, strategy, optimization, execution, the program.
**Stability & growth.** Inc. 5000, 20+ years, all 50 states, growing, established, proven, scaled.
**Direct economics.** wholesale, retail, margin, revenue, ROI, profit, billing, the difference is yours.
**Sales-cycle realism.** sales cycle, sales culture, advertiser mix, account executive, AE, broadcast buy, co-op, DMA.

### Vocabulary — words we **never** use

| Banned | Why |
|---|---|
| synergy, leverage, unlock, revolutionize | empty corporate cliché |
| world-class, best-in-class, cutting-edge | unprovable adjectives |
| rockstar, ninja, guru | undignified for a B2B audience |
| seamless experience, journey, transform | overused in agency marketing |
| AI-powered, AI-first | unless literally the topic; we say *"AI-Enhanced, Human-Verified"* |
| "in today's fast-paced world…" | filler opener — delete on sight |
| "we're passionate about…" | tells, doesn't show |
| game-changer, disruptive | not who we are |
| Forty-Four Eye, 44 Eye, 44 i | always "44i" |

### Headline patterns that work

These are the rhythms that recur across the source pages — use them as templates:

1. **Statement / Statement / Statement.** Three short claims, escalating.
   *"Traditional revenue is stable. Digital revenue is growing. You need both."*
2. **Problem / Solution dash.**
   *"Your invisible digital department. Fully operational from day one."*
3. **Two-line hero with em-dash break.**
   *"Your readers trust you. / Your advertisers should buy digital from you too."*
4. **Conditional + payoff.**
   *"Wherever your market is, we're already there."*
5. **Negative + positive.**
   *"We don't just fulfill orders. / We build your capability."*

### Eyebrow patterns

Eyebrows are conversational labels, not screaming uppercase. They prep the reader for the section's argument.

- *"The 44i Difference"*
- *"Why Partners Choose Us"*
- *"Our Commitment to Partners"*
- *"Built for Your Sales Culture"*
- *"For Newspapers, Magazines & Digital Publishers"*
- *"Common Questions from Agency Partners"*

The pill format is `● Eyebrow Text` — small filled dot, then label.

### Trust line — required at the bottom of every CTA

Every page ends with a CTA section. That section ends with a single trust line that **rotates 2–4 of these proof points**, separated by check marks and triple-spaces:

- ✓ Trusted by partners in all 50 states
- ✓ Inc. 5000 recognized
- ✓ 20+ years in digital marketing
- ✓ 5.0 stars across 30+ partner reviews
- ✓ No long-term contract required
- ✓ No cap on training

Example: *"✓ Trusted by partners in all 50 states   ✓ Inc. 5000 recognized   ✓ 5.0 stars across 30+ partner reviews"*

### Audience modes — same brand, four sub-voices

The brand has four primary partner segments. The voice doesn't change, but the **examples and proof points shift:**

| Segment | Talk about | Lean on |
|---|---|---|
| **TV / Radio Broadcasters** | The broadcast buy, OTT/CTV as the bridge product, co-op funds, AE confidence | "We've been selling digital alongside broadcast for 20+ years." |
| **Media Publishers** | Print + digital coexistence, advertiser trust, editorial vs. ad-side separation | "Your readers trust you. Your advertisers should buy digital from you too." |
| **Agencies** | Service expansion without headcount, margin protection, brand invisibility | "Offer every digital service your clients expect. Without hiring anyone." |
| **All partners (corporate)** | Inc. 5000, 50 states, dedicated strategist, no caps on training | "We only succeed when you succeed." |

### Examples (good)

- *"Your clients are going digital. Make sure they stay with you."*
- *"You sell the service. You set your price. We build it and deliver it. You keep the margin."*
- *"We don't place time limits on getting your new services off the ground."*
- *"Speed without quality isn't a service — it's a liability."*
- *"AI-Enhanced, Human-Verified."*

### Examples (bad — never write this)

- ~~*"Welcome to 44i Digital — your trusted partner for world-class digital transformation!"*~~
- ~~*"In today's fast-paced media landscape, we leverage cutting-edge AI to unlock seamless experiences."*~~
- ~~*"Our passionate team of digital ninjas is here to revolutionize your business."*~~

---

## VISUAL FOUNDATIONS

### Color

The palette is sampled directly from the live site (**44idigital.devlink9.info**): a **sky/cornflower blue** as the primary interactive color, a **deep slate-navy** for text and dark sections, and a **sage-green** supporting accent for data and highlights. White is the dominant surface. Neutrals are a cool gray scale.

| Role | Token | Hex |
|---|---|---|
| Primary (sky blue) | `--brand-blue` | `#4B9BD7` |
| CTA face / hover | `--brand-blue-bright` | `#639AD1` |
| Press · text-safe | `--brand-blue-deep` | `#2F6FA8` |
| Tint | `--brand-blue-soft` | `#E8F1FA` |
| Focus ring | `--brand-blue-glow` | `#A9CFEC` |
| Navy (ink + dark) | `--brand-navy` / `--brand-ink` | `#2B4863` |
| Navy deep (footer) | `--brand-navy-deep` | `#1B3145` |
| Green accent | `--accent-green` | `#A6D5A0` |
| Green text-safe | `--accent-green-deep` | `#6FB56A` |
| Paper | `--brand-paper` | `#FFFFFF` |

**Usage.** Navy is the workhorse dark — headlines, body ink, nav pills, and the dark data cards. Sky blue is for CTAs and interactive emphasis (note the site's `#639AD1` button face is light; use `--brand-blue-deep` when blue must carry white text at AA). Green is a *supporting* accent only — chart bars, the marker-underline highlight behind a keyword — never a second CTA color. Semantic feedback colors (`--success`, `--warning`, `--danger`) are utility, not part of the brand wardrobe.

### Type

**Manrope** for everything (display, UI, body). **JetBrains Mono** for code. Display sets tight (`-0.02em`), bold (`700`), with generous size jumps (`38 → 48 → 64 → 80 → 104`). Body sits at `16px / 1.5` for readability — partner audience reads dense B2B copy.

### Spacing & rhythm

A strict **4px base scale**: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128. Layouts breathe — section vertical padding is `--space-12` (96px) or larger on desktop. Marketing pages run long (the source copy averages ~1,500 words per page) so generous vertical rhythm is non-negotiable.

### Radii — *generous*

Cards `16–20px`, buttons `12–14px` or pill (`9999px`), inputs `12px`, modals `24px`, hero media `28–36px`. Never sharp 90° corners on interactive surfaces. The only `0px` radius lives on full-bleed dividers.

### Shadows & elevation

Soft, multi-layer, low-contrast. Never harsh. Default card uses `--shadow-sm`; lifted/floating uses `--shadow-md`; modals `--shadow-xl`. Brand CTAs get `--shadow-brand` (a tinted blue glow).

### Borders & dividers

`1px solid var(--border)` (`#E2E8F0`) is the default hairline. Use `--divider` (`#EEF2F7`) for soft section breaks.

### Backgrounds

White is the dominant surface. Sunken zones use `--bg-sunken` (`#EEF2F7`). For dark sections we move to `--brand-ink` — these are full-bleed, photo-led, with type knocked out white. Gradients are **rare** and limited to subtle tonal washes. **No** rainbow gradients. **No** decorative noise textures.

### Imagery

Photography is **professional, partner-environment, real-people** — broadcast control rooms, newsrooms, agency offices, sales teams in conversation. **Not** cinematic art-house, **not** lifestyle stock. People-forward. Real-world settings. Subtle desaturation OK; heavy filters are not.

### Logo & the "44" facet motif

The three-facet shape from the icon is a recurring graphic device — used at large scale as a watermark, a section opener, or sliced into background geometry. Never recolor the facets independently; the mark is one-color.

### Hover, press, focus

- **Hover (buttons):** background shifts one step *brighter* (`blue` → `blue-bright`). No translate/lift on buttons.
- **Press / active:** `transform: scale(0.98)` over `120ms ease-out`, background shifts one step *deeper*.
- **Focus-visible:** `box-shadow: var(--ring)` — a 3px translucent blue halo. Never remove focus rings.
- **Disabled:** `opacity: 0.45`, `cursor: not-allowed`.

### Animation & motion

Confident, fast-out, slow-settle. Default ease `--ease-out` `cubic-bezier(0.22,1,0.36,1)`. Durations 120–360ms. We **don't** bounce UI. Page transitions are simple cross-fades, never page slides.

### Cards

White background, `--radius-lg` (16px) or `--radius-xl` (20px), `--shadow-sm` default, `1px` border `--border`. Hover: `--shadow-md` and a `2px` lift. Inner padding starts at `--space-6` (24px) and scales to `--space-8` (40px) on feature cards.

### Layout rules

- Max content width `--container` (`1200px`) on most surfaces.
- Marketing sections vertically padded `--space-12` (96px) min.
- Sticky top nav, 64px tall, white with backdrop blur on scroll, **brand-blue phone number** and **brand-blue primary CTA** to the right.
- Footer is dark (`--brand-ink`), with the wordmark left, partner-segment links right, fine print bottom.

### Page architecture (marketing)

Every interior page in the source copy follows the same **8-block rhythm**. This is the system:

1. **Hero** — eyebrow pill, large headline, subhead, body, primary CTA, secondary link.
2. **Stats row** (optional) — 4 pillar numbers with labels.
3. **The challenge / problem** — 3 challenge cards or full-width body.
4. **The 44i solution** — split layout, supporting cards on right.
5. **What you get / services** — grid of 4–8 cards or service tiles.
6. **Training / how it works** — sequential cards or step timeline.
7. **FAQ** — accordion of partner-specific questions.
8. **Final CTA** — eyebrow, headline, body, primary + secondary CTA, trust line.

Use this as a template for every new partner-segment page (Auto, Healthcare, B2B, etc.) so the brand is uniform across pages.

---

## ICONOGRAPHY

44i Digital is **not** an icon-heavy brand. The hero visual language is type, professional photography, and the "44" facet mark — not an army of decorative pictograms.

The source copy uses **emoji** as quick-and-dirty section markers (📊, 📺, 🎯, 📌). **We do not use emoji in the design system.** They're a placeholder in the copy doc — we replace every emoji with a Lucide stroke icon at delivery.

When icons are necessary (UI controls, navigation, service-card markers), we use **Lucide** at `1.5px` stroke. Lucide's geometric, even-weight, slightly rounded line style matches the geometry of the "44" mark and the radius vocabulary of the system.

```html
<!-- CDN-loaded; no install -->
<script src="https://unpkg.com/lucide@latest"></script>
<i data-lucide="arrow-right" stroke-width="1.5"></i>
<script>lucide.createIcons();</script>
```

### Service → icon mapping

The marketing copy uses emoji for each service. Replace with these Lucide icons:

| Service | Emoji in copy | Lucide icon |
|---|---|---|
| SEO | 🔍 | `search` |
| Google Business Profile | 📍 | `map-pin` |
| Reputation Management | ⭐ | `star` |
| Responsive Websites | 🌐 | `globe` |
| Social Media | 📱 / 📘 | `share-2` |
| Email Marketing | 📧 | `mail` |
| Native Advertising | 💬 | `message-square-quote` |
| Search Ads / SEM | 🎯 | `target` |
| Display Advertising | 🖥️ | `monitor` |
| OTT / Connected TV | 📺 | `tv` |
| Programmatic Video | 📡 | `radio-tower` |
| Geofence Targeting | 📌 | `pin` |
| Addressable Targeting | 🏠 | `home` |
| Event Targeting | 🗓️ | `calendar-days` |
| CRM / Push Text | 📲 | `message-circle` |

### Rules

- **Default size:** 20px or 24px, stroke `1.5`, color `currentColor`.
- **Color:** never blue by default — icons are `--fg-1` or `--fg-2`. Brand blue is reserved for *active / interactive* states.
- **Filled icons:** avoid. Stroke only.
- **Emoji:** **never** in shipped product, marketing, decks, or comms.
- **Check marks** in trust lines are the Unicode `✓` (U+2713) at brand-blue or brand-ink — not an icon.
- **Logos** (the "44" mark and full lockup) live in `assets/` with named variants — never re-render or recolor manually.

---

## CTA STRATEGY

Across every interior page, CTAs are uniform. This is part of the brand.

- **Primary CTA:** *"Book a Free Demo →"* (links to `/demo/`). Brand-blue solid button, white text, trailing arrow.
- **Secondary CTA:** *"Call 605.271.7321"* (tel link). Ghost button or inline link.
- **Tertiary (page-specific):** *"Download the [Partner type] Overview"*, *"View detailed service descriptions →"*. Inline link, brand-blue, with trailing arrow.
- **Hero subline:** Often a 20-minute promise — *"Book a free 20-minute demo. No pressure. No obligation."*

Every page ends with a CTA section: dark or tinted background, eyebrow + headline + body + primary + secondary + **trust line**. (See *CONTENT FUNDAMENTALS → Trust line*.)

---

## Caveats / Open questions

1. **Palette is sampled from the live site** (`44idigital.devlink9.info`) by pixel-reading a homepage screenshot: sky blue `#4B9BD7` / `#639AD1`, navy `#2B4863`, green `#A6D5A0`. These are read to ~±2 per channel — **send the official brand hex / Pantone values** and we'll lock them exactly. Note the site's blue is a soft cornflower, *not* the brighter cyan (`#009DDC`) of the supplied logo vector.
2. **Logo color vs. site.** The provided logo SVGs were cyan `#009DDC`; the live site renders the mark in the sky blue, so the blue logo variants in `assets/` are now recolored to `#4B9BD7` to match. If the official master logo should stay cyan, say so and we'll split "logo color" from "UI blue."
3. **CTA contrast.** The site's `#639AD1` button face with white text is ~2.6:1 (below WCAG AA for normal text). We kept it to match, but `--brand-blue-deep` (`#2F6FA8`) is provided for accessible text-on-blue. Flag if AA compliance is required.
4. **Typeface is Manrope** (Google Fonts, geometric-leaning humanist sans). If 44i has a licensed brand sans, drop the files in `fonts/` and we'll swap it in.
3. **Iconography library is a substitute.** Lucide chosen for tone fit. Confirm or replace.
4. **Imagery is described, not shown.** No photo library was supplied. UI kit uses placeholders calling out subject matter (broadcast control rooms, agency offices, sales meetings).
5. **Inc. 5000 logo / partner logos** not provided. Trust badges in the UI kit use placeholder marks.
6. **Phone number:** `605.271.7321` is documented in source copy. Confirmed canonical contact.
