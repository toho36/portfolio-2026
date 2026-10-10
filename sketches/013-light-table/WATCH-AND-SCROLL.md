# Watch identity and assisted deck settling

Owner's latest request replaces the bare movement cover with a recognisable watch and requests gentle next-slide settling after scrolling pauses. Applies only to `sketches/013-light-table`, production unchanged.

Watch: live skeleton wristwatch with one hollow, closed oval leather band, beveled edges, curved stitching and connected lug pins. Fixed oblique pose reveals the band's depth. Face-local pointer proximity gently lifts the transparent glass/bezel up to .38 model units (glass adds .08) along the local normal; leave/reenter reverses the current bounded progress. Hands/gears remain quietly alive. No pointer-driven spinning or translation. Coarse pointers receive one short .65 reveal per activation; reduced motion/no-WebGL remains static. CTA hover/focus invites the lid; the balance has three spokes and an asymmetric weight. The same canvas/presentation moves into a warm ivory watch-focused native dialog. The renderer is not remounted on navigation, reveal freezes in detail and phase continues. Full case study remains an explicitly separate secondary link; production routes are deferred.

Scroll: native wheel/touch remains free; input immediately interrupts assistance. The coast keeps the sampled incoming velocity. Ordinary input only decelerates; extremely light input requires one smooth speed hump to avoid distance/speed taking tens of seconds. Initial acceleration is zero on that branch, the coast is capped at 1500 ms, and its terminal velocity is zero. Fast input retains the two positive decreasing velocity terms with a shorter tail. Explicit navigation uses 650 ms and selects its exact destination. No overshoot, repeated auto-skipping or interference with dialog/credits/footer; touchHeld remains independent of touch-panning pointercancel. Reduced motion settles instantly. Own/cancel timers and RAF on unmount/hidden/dialog.

Verify first rendered watch recognition on desktop/mobile, actual moving hands/gears, preview parity and cleanup. Unit RED/GREEN for settle selection/easing; native wheel pause/reverse/interruption/touch, CTA and current ball-return/momentum regressions. Physical phone remains separate. No commit/deploy.

Native preview regeneration and browser verification require a host that can launch Chrome and reach the local preview. The PNG is 700 × 700 RGBA. After building the current source, run from the repository root in this order:

```sh
python3 sketches/013-light-table/watch-reveal.py --capture-preview
./node_modules/.bin/vite build sketches/013-light-table --outDir /Users/vitek/.hermes/cache/scratch/light-table-build --emptyOutDir
python3 sketches/013-light-table/watch-flow.py
python3 sketches/013-light-table/watch-reveal.py
python3 sketches/013-light-table/scroll-continuity.py
python3 sketches/013-light-table/watch-scroll.py
python3 sketches/013-light-table/held-touch.py
python3 sketches/013-light-table/card-actions.py
python3 sketches/013-light-table/ball-return.py
python3 sketches/013-light-table/ball-momentum.py
python3 sketches/013-light-table/ball-parity.py
python3 sketches/013-light-table/ball-3d.py
```

Capture uses `watchView.snapshot(0)` on a 700 × 700 host at DPR 1, time zero, closed. It writes the exact native renderer to `public/watch-preview.png`, checks transparent corners, and closes only its owned browser. Rebuild copies that PNG into the running 5186 server's root. The subsequent reveal probe checks served hashed JavaScript bytes against the isolated build, visible native pixel differences between deterministic closed/open renders, face enter/leave/reenter, fixed assembly pose, exact CTA/dialog renderer continuity and offsheet/hidden teardown, hidden-time suspension, both narrow mobile bounds, coarse-pointer pulse, reduced/no-WebGL preview parity and context loss. Evidence goes to `/Users/vitek/.hermes/cache/scratch/light-table-reveal-<timestamp>/` (native images, desktop/narrow closed/open screenshots and `acceptance.json`). The existing scroll continuity gates remain in place; native traces now also require landing within 1800 ms after the final input. No physical-phone or physical-trackpad claim.


First-stage flow acceptance: `watch-flow.py` reads the served JavaScript against the isolated build, checks all three native CTA hover/press palettes and stationary bounds, native keyboard focus, modifier/middle-click tabs, dialog focus containment, first-frame source framing, per-frame canvas/scene identity, reveal/phase continuity, interrupted Escape/Forward/Back, exact return scroll/focus, direct hash, narrow 390/320 layouts, hidden disposal and reduced/context-loss/no-GPU/coarse touch paths. It saves actual start/middle/end screenshots and temporal samples under scratch. Programmatic scroll seeding and emulated capabilities are labelled; physical devices remain untested. `watchFlow.test.mjs` checks endpoints, soft landing, rapid reversals, hidden-time pause and frame disposal; `watchScene.test.mjs` retains real Three geometry/resource checks. No browser checks were run in the writing sandbox.

GameOnVB's approved isolated entry now uses the same imperative ownership approach with a separate ballistic clock and top-tread landing. It preserves the card ball's meshes/material/spin and leaves watch motion unchanged. `ball-flow.py` is the parent-run acceptance companion; `card-actions.py` now expects the approved `#gameonvb` navigation and checks its separate production link. Run both after rebuilding 013. Production integration and step/environment redesign remain deferred; browser/GPU acceptance was not run in the writing sandbox.
