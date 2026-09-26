# Homepage "Poster Slider" — design

Status: owner-approved 2026-09-26. Replaces the current homepage (`src/pages/Home.tsx`). Playground (hot wire) is a separate route and not part of this work.

## Intent

- Audience: HR, hiring managers, tech leads. The site must read as an experienced engineer with taste, not a template or a "vibecoder" portfolio — while showing he adopts new tools early.
- Premium, award-level craft; calm. One thing moves at a time and gets full focus.
- Tone: professional, restrained. No puns. The word "AI" never appears in headlines.
- Facts only from `src/content/*` plus owner-confirmed: works solo and in multi-developer teams at SolidPixels (CMS platform, client sites, frontend, backend, third-party integrations). Do NOT claim GameOnVB is "in use", do NOT state a location.

## Copy (final)

- Role label: `Software Developer`
- Hero (poster 00): **New tools. Old standards.** Subline: *I move quickly with new technology and keep the engineering discipline that teams rely on.*
- Positioning line (small, under hero): *I adopt new tools early and hold their output to the same standard as my own, whether I'm shipping alone or with a team.*
- 01 GameOnVB — **Operations, made quiet.** *Registration and organisation for recurring recreational volleyball events, handled by one focused product.* → `/gameonvb`
- 02 SolidPixels — **Shared codebases, shared standards.** *At SolidPixels I work with other developers on a CMS platform and client sites: frontend, backend and third-party integrations.* → no internal page; no link unless owner adds one (render as non-link poster).
- 03 Goal Loop — **Speed with hard checks.** *Several models build, critique and review. Every result passes explicit verification gates or is blocked.* → `/goal-loop`
- 04 Playground — **Interaction, studied closely.** *A real-time 3D skill game. An exercise in input, feedback and rendering on every device.* → `/playground`
- 05 Small tools — **Small tools, finished properly.** *Screen Switch, a native macOS utility, and Suburbs, a frontend concept for a skateboard brand.* → Suburbs link `https://suburbs.vercel.app/` (from content), Screen Switch no link.
- 06 Contact — **Let's talk about your project.** *Roles, collaborations or a difficult software problem. Email is the fastest way to reach me.* Links from `CONTACT` (Email, GitHub, LinkedIn, CV EN, CV CZ).
- Microcopy: hint `Scroll to browse` (desktop) / `Swipe to browse` (touch); CTA `View project`; contact CTA `Get in touch`; 404 `This page doesn't exist.`; loader `Loading`.
- Update `src/content/routes.ts` home title/description to match (e.g. `Hoang Viet To — Software Developer`, description from positioning line). Remove "independent software systems builder" wording.

## Visual system

- Background ink `#0b0b0b`; type paper `#f2efe6`. One accent per poster (GameOnVB court orange `#ff5a24`, SolidPixels blue `#1557ff`, Goal Loop signal `#d9ff43`, Playground signal `#d9ff43`, Tools focus `#63e6ff`, Contact paper).
- Film grain overlay 3–5 % opacity (static noise texture, CSS, `pointer-events: none`), respects reduced motion (no animated grain).
- Typography: one display sans (existing site font stack) + one mono for labels. Display `clamp(3.5rem, 12vw, 16rem)`, tracking −0.045em, line-height 0.9. Body 16–17 px. Labels mono 11–12 px uppercase, tracking +0.08em.
- Grid: 12 columns desktop, 4 mobile, gutter ~1.5vw; everything aligned to columns; 25–40 % empty space.
- Easing: reveals `cubic-bezier(0.16,1,0.3,1)` 0.9–1.4 s; UI `cubic-bezier(0.25,1,0.5,1)` 0.3 s; transitions `cubic-bezier(0.76,0,0.24,1)`. No default `ease`.
- Designed details: custom scrollbar, `::selection` (accent on ink), focus rings (2 px accent, offset 3 px), 404 page in the same system.

## Structure and motion

- Header (fixed): `Hoang Viet To` left, role label, index `00 / 06` right. Minimal nav to routes.
- Loader: ink screen, mono `0–100 %` counter driven by real readiness (fonts + three import + first render), < 2 s typical; hands off into hero: hero words rise from a mask line by line (expo-out, 80 ms stagger).
- Slider: full viewport, one poster at a time.
  - Desktop: wheel / trackpad, click-drag, arrow keys, and `PageUp/PageDown`. Inertia with snap to nearest poster (expo-out).
  - Signature motion (the only strong one): while dragging/scrolling, the poster's WebGL visual bends proportional to velocity (clamped), then settles.
  - Overlap: the incoming poster slides over the outgoing one; the outgoing scales to 0.92 and dims to 60 %. Headline partially overlaps the visual; the overlapping part uses `mix-blend-mode: difference`.
  - Touch: native `scroll-snap-type: x mandatory` horizontal scroller (momentum preserved); WebGL visuals follow `scrollLeft`. No pinned vertical-to-horizontal scroll hijack on touch.
- Poster click → route with shared-element transition: poster visual grows into the target page hero (View Transitions API when supported; else a 400 ms curtain with the transition easing). Never a white flash.
- Magnetic contact CTA (pull ~0.3, desktop only).
- Optional desktop cursor: small dot → label `Drag` over slider, `Open` over posters. Hidden on touch.

## Poster visuals (generated, no photos)

One shared three.js canvas; each poster a scene or shader in its accent, one light direction.
1. GameOnVB — volleyball court lines in perspective, one ball arc trace drawing itself when the poster becomes active.
2. SolidPixels — stacked modular page blocks (CMS sections) that settle into a layout with slight overlap.
3. Goal Loop — a row of gates; a line passes through the first gates and is stopped at one (pass/block).
4. Playground — static render of the VITEK wire in the playground style (geometry only; do not import playground runtime; a simplified path is fine).
5. Small tools — two display outlines exchanging a window + a skateboard deck outline.
6. Contact — no 3D; giant email address type.
Each visual animates once on becoming active (≤ 1.4 s), then rests. Idle = still.

## Accessibility and fallbacks

- Markup: semantic `<main>` with an ordered list of poster `<article>`s; each has heading, text, link. Works fully without WebGL/JS (SSR renders all copy; CSS scroll-snap slider).
- Keyboard: arrows move posters; focus moves to active poster heading; `aria-live` announces `02 of 06: SolidPixels`.
- `prefers-reduced-motion`: no bend, no grain animation, cross-fade between posters, instant loader hand-off.
- WebGL missing/failing: posters show CSS-only accent compositions; no error.

## Performance

- three + gsap dynamically imported on `/` only after first paint; one import seam.
- DPR cap 2 (1 on weak tier: first 30 frames avg > 22 ms). Render only when slider moving or a visual is animating; pause on hidden tab.
- LCP element is the hero text (not canvas). Lighthouse targets: Performance ≥ 90 mobile, Accessibility 100.

## Testing

- Unit: slider math (velocity → bend clamp, snap target, index from offset) as pure module; loader progress; content (copy strings match this spec; no "AI" in headlines; no banned phrases "independent software systems builder", "in use").
- SSR test of homepage markup: 7 posters (00–06) in order with headings, links as specified, SolidPixels non-link.
- `npm test`, `npm run check`, `npm run build`, `git diff --check`.
- cmux proof (`npx vite --host 127.0.0.1 --port 4183 --strictPort`): loader → hero, each poster at desktop 1440-wide and narrow viewport, mid-drag bend frame, transition to `/gameonvb`, reduced-motion check; FPS; console errors 0.

## Out of scope

- Case-study pages redesign (only the entry transition target). Playground. New content beyond this spec.
