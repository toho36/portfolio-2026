# T3 hero preview

This harness mounts only `Hero`, with T1 page styles and T2 tokens. It does not register a route or import `LandingPage`.

From the repository root, the parent can run the existing Vite dev command and visit `/sketches/025-landing/hero/`. No server was left running by the worker.

T6 integration: import `Hero` from `src/home/landing/hero/Hero.tsx`, pass the page's shared `DominantMotion` as `coordinator`, and supply the `HeroProps` copy. Approved defaults are exported from `hero/content.ts`. The page must load `shared/tokens.css` and `landing.css` and provide the `landing-page` wrapper and `#work` / `#contact` destinations.

Starts on step 1 without autoplay. Arrow keys / Home / End select and focus a tab; Enter / Space activate its native button. Play / Pause / Resume / Replay uses 2500 ms of complete-state reading plus 240 ms per transition (zero transition for reduced motion). Pause discards elapsed reading time, so Resume provides another full interval. Each selection stops playback. Hidden documents, viewport exit and coordinator cancellation pause without automatic resume.

Inspection attributes on the figure: `data-p1-step` (1–4), `data-p1-status`, `data-p1-transitioning`. Parent QA: all four steps at 1440×900 and 390×844, plus 1280×720, 768×1024 and 320×640; verify actual motion, text legibility, image failure fallback, tab keyboard interaction, offscreen/hidden pause, reduced motion, and cancellation by another module. The isolated harness has no work/contact sections, so its anchor links are integration-only.

Crops: `sips --cropToHeightWidth H W --cropOffset Y X SOURCE --out DEST` on the supplied 2× sources. Untouched, separate detail crops compose the same desktop/mobile evidence at a maximum width of 280 px (reservation/name), 200 px (date/occupancy), 180 px (VS), or 140 px per result. This avoids shrinking a complete desktop row. Step 4 reuses T1's approved crops. Missing images become their text descriptions; captions and before/after states remain HTML.
