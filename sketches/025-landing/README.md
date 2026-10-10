# 025 — Static landing composition / T1

Preview harness only. It mounts `src/home/landing/LandingPage.tsx`; no app routes are changed. Serve with the existing Vite setup and open `/sketches/025-landing/`. The standalone build uses this directory as its root.

- Warm paper-dark ground, Georgia display and the repository's Arial/Helvetica text stack. A 60px desktop headline leaves room for responsibility and evidence. Pale sage is reserved for focus, selected disclosure numbers, selected form topic and the final lifecycle state.
- Hero pairs a clear statement with one GameOnVB end-state proof. All four lifecycle labels and the reconstruction/simulated-bank labels are HTML. The supplied Czech screenshot is documentary evidence; the English end-state caption carries its meaning without relying on image text.
- A ruled project index replaces cards. SolidPixels opens first, uses a larger title and a two-column text detail separating team context from personal contribution. Its unpublished example is omitted. No SolidPixels UI appears.
- Mobile is composed separately: full-width proof panel, two-column lifecycle labels, three targeted, untouched crops of the 2× desktop source and native project disclosures. The full player identity sits above matched/arrived states in a 240px frame. At 320px, the smallest decisive text is at least 12.10 CSS px even when measuring only the visible glyph ink; no state is clipped. The same composition stays legible on desktop. The other three projects start collapsed.
- Every section uses a left heading/right action baseline. Contact keeps the approved copy, existing email/CV links and familiar labelled fields. This static study disables submission and labels it as a preview; live form behavior is T5.

No motion, timers, animation libraries, sticky/fixed navigation or nested scrolling. Disclosure changes use browser-native `<details>` with no transition; reduced motion has the same complete states. Keyboard focus is visible. Tests cover semantic content and proof honesty, not rendered geometry.

Parent visual checks required at 1440×900, 1280×720, 768×1024, 390×844 and 320×640, including SolidPixels open (the initial state). Check natural overflow, the mobile crop and work-section density. No screenshots or browser checks were performed by this worker as instructed. Project links point to the application's existing routes, which the standalone harness does not mount. Root-relative CV files remain the existing app's responsibility; this sketch build does not copy the app public folder.
