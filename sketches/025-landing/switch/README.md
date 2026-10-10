# Screen Switch module preview

Mounts only `src/home/landing/switch/ScreenSwitch.tsx`, with the T1 page stylesheet and T2 tokens. No route or LandingPage integration.

From the repo root, the parent can serve Vite and open `/sketches/025-landing/switch/` using `~/bin/cmux-tab`. This worker did not start a server or perform browser checks.

Integration: pass `ScreenSwitchProps` from `shared/types.ts`. Use the same coordinator as the other landing modules, `screens={['Left display', 'Right display']}`, and `illustrationLabel="Illustration of the feature"`. `screens` names the fixed display slots; `onSwap` receives the display names currently assigned to Window A and Window B, in that order, after completion or settlement. Dispose the page-owned coordinator on page unmount; the component only releases its own ownership/listeners.

The native button handles click, tap, Enter and Space. Both windows animate on the same document timeline for 280 ms. Rapid actions settle the previous target and start a new swap immediately; no queue. A competing module, hidden document, offscreen intersection, resize or reduced-motion change settles to a complete state, without automatic playback on return. Mobile stacks the displays; the inherited aria-live wording continues to call the logical first/second slots left/right.

Parent QA: 1440×900, 1280×720, 768×1024, 390×844, 320×640; verify visible focus and tap/keyboard, no idle motion, both windows start/end within one frame, cross-module interruption, offscreen/hidden settlement, and reduced motion (including changing the preference mid-swap). Verify `document.visibilityState` before motion assessment. The model tests check synchronization inputs and controller lifecycle, not real browser rendering.

Build: `node node_modules/vite/bin/vite.js build sketches/025-landing/switch --config vite.config.ts --outDir /tmp/landing-t5a-build --emptyOutDir` (add `--configLoader native` if required by sandbox config loading).
