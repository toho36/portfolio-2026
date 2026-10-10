# Ball entry writer checks

Scope: only `sketches/013-light-table/`. Dirty WIP was inspected first and preserved. No installs, server changes, production build, staging/commit/deploy or browser access.

RED observed before implementation:

- `node --test sketches/013-light-table/ballFlow.test.mjs`: exit 1, 0 pass / 3 fail (missing ballistic motion, interruption clock, frame owner).
- `node --test sketches/013-light-table/ballScene.test.mjs sketches/013-light-table/ctaPress.test.mjs`: exit 1, 0 pass / 3 fail (React host still owned canvas; GameOnVB handler/hash missing).
- Extended scene first-frame lighting assertion: `node --test sketches/013-light-table/ballScene.test.mjs`: exit 1, 0 pass / 1 fail (source lighting changed immediately). Corrected by moving light targets with the source frame before gradual lighting changes.
- Static landing projection slice: same scene command, exit 1, 1 pass / 1 fail (CPU same-tread fallback missing).

Focused GREEN: motion 3/3; ownership/navigation/motion 6/6; extended scene/fallback 2/2. GPU was stubbed in the scene test; Three geometry, materials, camera and resource disposal are real. The test does not establish native pixels.

- First-frame latch slice: `node --test sketches/013-light-table/ballFlow.test.mjs`: exit 1, 3 pass / 1 fail (source latch missing); GREEN exit 0, 4 pass. Entry source pose is now used only before flight starts, never on the last return frame.

- Orthographic pop slice: `node --test sketches/013-light-table/ballScene.test.mjs`: exit 1, 1 pass / 1 fail (forward depth had no apparent size change). Added a bounded scale cue proportional to the existing forward displacement; final radius stays .92 and source radius stays exactly 1.

Initial writer verification:

- `node --test sketches/013-light-table/*.test.mjs`: exit 0, 31 pass / 0 fail.
- `npm run test`: exit 0, 37 test files / 223 tests passed.
- `npm run check`: exit 0 (`tsc --noEmit`).
- In-memory Vite/Oxc JSX transforms: study.jsx, Volleyball.jsx and Watch.jsx parse successfully; no build output written.
- Python AST parsing: ball-flow.py and card-actions.py syntax OK; neither executed.

Parent must rebuild the isolated scratch output, then run `ball-flow.py` and existing watch/scroll/held-touch/card/ball probes. Browser probe checks served JS bytes, native primary/modifier/middle/key/history/touch activation, first-frame framing and every rotation axis, one renderer/canvas, angular momentum, measured edge, upper landing, interruption, exact scroll/focus return, 390/320 fit, direct hash, reduced/no-GPU/context-loss, hidden release/time pause and offsheet disposal. Saves actual start/pop/edge/fall/land/return images and traces to scratch. Capability/touch/visibility simulation is labelled emulated. Physical devices NOT TESTED.

Remaining acceptance risks: native pixels/compositing and the perceived camera tracking during descent; extended framebuffer GPU cost on physical mobile; simplified CPU stone shading in static mode. Context loss retains the last available same-ball native preview and logical spin/clock; it cannot recover pixels already discarded by the GPU. No visual/browser success is claimed by the writer.

Verified-defect follow-up:

- Actual restore handler RED reproduced `resize → close(painted=false)`; GREEN repaints the latest recorded source pose before close. Current spin/time/momentum and the entry latch are preserved.
- Actual Volleyball effect RED advanced hidden-at-setup flight to 1.6; hidden reduced-toggle recreation also called land. GREEN pauses each new hidden flow before set, resumes through the existing visibility handler, and rejects late callbacks after cleanup.
- Actual paint handler RED measured wash .65 while reveal was 0. GREEN ties wash to scene reveal, retaining the card through pop/lower-edge clearance and beginning the gradient during fall. Ballistic curve/renderer unchanged.
- Caption placement RED found top 80px; GREEN bounds the exact caption at bottom-left. Node checks a conservative caption envelope against the existing projection at 1440x1000, 1000x900, 768x1024, 390x844 and 320x780. This is not native pixel evidence.
- Probe RED found generic dialog queries and rejected scrollY 717 against target 717.4/data-position .999. GREEN scopes watch queries/controls to `.goal-entry`, asserts zero open dialogs for selection/cancel, and uses <1px actual-scroll readiness for ball selection and tap, including completed settling. Identity/phase/touch/press/keyboard/history contracts remain intact.
- `ball-flow.py` now records projected ball/caption bounds at all five sizes and captures failure URL, scroll/target, viewport, datasets and focus. Parent execution still required.

Follow-up verification: `node --test sketches/013-light-table/*.test.mjs` passed 38/38; `npm run test -- --no-cache --configLoader runner` passed 37 files/223 tests (cache/config bundle writes disabled); `npm run check` passed. All 13 Python probes parsed without execution; changed JSX parsed in memory. Only 013 files were edited. Directly related snapshot/disposal paths were inspected; no additional verified defect was established. No builds, browser launches or browser-success claims. Parent must rebuild, rerun native probes, inspect full views and obtain a fresh read-only review of final bytes.

Second and final bounded writer pass (review2 blockers A/B and fixtures C/D):

- Read the current parent-owned `review2-final.txt` in Hermes scratch. One writer; all edits in `sketches/013-light-table/`. Parent-owned `lifecycle-extra.py` was not edited or executed.
- A RED: `node --test sketches/013-light-table/dialogHandoff.test.mjs` produced 2 pass / 4 fail, each cross-hash direction/reversal failing because the incoming modal opened before outgoing restore. GREEN: 6/6. The harness executes the actual hash sync, CTA/back and layout handlers with controlled state commits, DOM ownership and real watch/ball flow controllers. It checks at most one open modal, lock ownership throughout, deferred incoming mount, current-pose reversal, stale pending intent cancellation, same renderer identities, exact same-document scroll return, nonempty prior overflow and cleanup. This is controlled handler evidence, not React/browser runtime proof.
- A fix: keep desired flags current, defer incoming mount while the opposite renderer's restore ref exists, and fulfil still-current opposite intent only after outgoing `land(0)` restores/releases the lock. No mounted-state effect gate or transition framework was added.
- B RED: `node --test sketches/013-light-table/ballFlow.test.mjs sketches/013-light-table/ballEntryLifecycle.test.mjs` produced 7 pass / 3 fail: both paused-controller tests advanced `.4 → 1.6`, and the actual hidden reduced effect called `land(1)`. GREEN initially 10/10; final extended coverage includes both entry/return endpoints with instant/regular resume.
- B fix: paused `set()` stores target/preference without clock/velocity changes, paints or land; resume applies the latest preference, and destroy cancels pending reduced snap. The real Volleyball effect harness now captures the clock BEFORE normal-hidden → reduced-hidden → normal-hidden recreation, asserts clock/no paint/no land after each setup/cleanup, then visibly resumes to the requested endpoint. The earlier toggle test captured its baseline after the reduced snap and did not prove that transition; this pass corrects that evidence gap.
- C fixture: true cold `#gameonvb` entry now uses a fresh owned context/page, calls `opened(pg)`, `ready(pg)` and `closed(pg)` on it, asserts source and return scroll are both zero, and leaves the main page's scroll intact for later hidden/context-loss checks. Same-document scroll preservation remains asserted in the handoff harness.
- D fixture experiment **ROLLED BACK after parent A/B**: the replacement `is_mobile=True`/`has_touch=True` context failed the first raw-CDP post-fling tap. The exact pre-task touch section passed first-tap readiness against both the immutable baseline and current v3 builds (`baseline-touch.py baseline` and `baseline-touch.py candidate`: exit 0, PASS), served from real installed-Vite compiled bytes with only owned-page5186 requests fulfilled. This established a fixture change, not a confirmed new app regression. Restored the original owned desktop context/page at its existing `390x844` viewport and retained its action locator. Capability reporting labels native CDP touch on desktop capabilities at mobile viewport; maxTouchPoints/coarse are diagnostics, not requirements. Source-specific `.goal-entry` selectors, zero-open-dialog assertions, raw native CDP pan/tap, strict `scrollY<1`/settled readiness, input timestamps/points and compact failure diagnostics remain. The original context closes normally in `finally`. Dedicated `watch-flow.py` and `ball-flow.py` verify real emulated-mobile capabilities and passed on v3 according to parent results. No app, threshold or native gesture assertion changes.

Final writer gates:

- `node --test sketches/013-light-table/*.test.mjs`: exit 0, 48/48 passed.
- `npm run test -- --no-cache --configLoader runner`: exit 0, 37 files / 223 tests passed.
- `npm run check`: exit 0.
- Changed `study.jsx` parsed using an in-memory Vite/Oxc JSX transform; both changed Python fixtures AST-parsed without execution.
- Browser/runtime: **NOT RUN**. No build, server, install, git mutation, Chrome/localhost access or sandbox change. Scroll model/thresholds, pointer/momentum, scene/camera, caption and production/prior sketches were not edited. Parent rebuild, full native regressions, extra lifecycle script and fresh focused read-only veto remain required.

Fixture rollback verification: `node --test sketches/013-light-table/*.test.mjs` exited 0 (48/48 passed); `verify.py` parsed with Python AST, exit 0, without execution. Only `verify.py` and this check document changed in the rollback. Parent runs the final exact `verify.py` and all gates; the mobile-context experiment is not retained or claimed passing.

## Step 2 writer verification — 2026-10-02

Read-only `git status --short` was the first command. Existing uncommitted step 1 and unrelated WIP were preserved. One serial writer, workspace-write sandbox, only existing 013 files patched. No git mutations, installs, servers, browser access, builds or deployment ran.

Runtime paths changed:

- `sketches/013-light-table/ballFlow.js`: concrete .30 pop / .32 settle / 1.08 accelerating roll / .15 corner / 1.25 ballistic air / .45 landing sampler, backwards source anchor, logical quaternion/residual derivative, exact forward rolling angle and ~1.3s return clock.
- `sketches/013-light-table/ballScene.js`: shared live/static screen frame, fixed contact camera orientation, soft contact shadow, bounded air framing, stationary landing camera, resize fit and actual trace datasets. Existing meshes/materials/canvas remain the same while eligible.
- `sketches/013-light-table/Volleyball.jsx`: logical orientation stepping by the existing sole RAF owner, complete orientation basis handoff before source repaint, preservation through GPU release, current clock diagnostics.
- `sketches/013-light-table/ballMotion.js`: only `stepSpin` preserves the optional orientation basis via object spread. Brush impulses, momentum values, damping, sampling and ordinary motion equations are unchanged.
- `sketches/013-light-table/study.jsx`: measured card transform origin, lower flex-content/label band, actual lower-left corner and source affine; contact fan frame pinned through resize and restored exactly; shared contact translation/resize fit; same-model fallback placement; visible navigation focus after changed-height return with exact saved scroll.
- `sketches/013-light-table/ballSteps.js`: CPU projection moved to the same final target as the live camera. Block, stone and trim construction is unchanged.

Checks changed: `sketches/013-light-table/ballFlow.test.mjs`, `sketches/013-light-table/ballScene.test.mjs`, `sketches/013-light-table/ballEntryLifecycle.test.mjs`, `sketches/013-light-table/dialogHandoff.test.mjs`, `sketches/013-light-table/ballMotion.test.mjs`.

Observed RED → GREEN slices:

- `node --test sketches/013-light-table/ballFlow.test.mjs`: initial RED 7 pass / 4 fail for absent captured choreography/orientation and slow return; final GREEN 13/13. Subsequent RED proved captured radius .85 was ignored and actual quaternion travel did not equal distance/radius; both assertions now pass.
- `node --test sketches/013-light-table/dialogHandoff.test.mjs sketches/013-light-table/ballMotion.test.mjs`: initial RED 8 pass / 3 fail for DOM contact capture, changed-height focus and discarded basis; final GREEN 12/12. Additional fractional transformed-DOM RED caught rounded source origin/corner. The actual handler fixture now verifies exact source affine and restored fan styles.
- `node --test sketches/013-light-table/ballScene.test.mjs`: RED caught desktop corner-outline clipping, corner-to-air screen velocity discontinuity, fractional static/live tread mismatch, resized contact clipping, invisible landing bounce caused by camera tracking, and contact shadow retained on source repaint. Final GREEN 2/2, covering dense phase samples in 1440x1000, 390x844 and 320x780, contact resize to 320x780/390x844/844x390/1440x1000, unchanged world pose/quaternion, current projection, <=.25 viewport total upward travel and <=4MP/DPR1.5 buffer bounds.
- `node --test sketches/013-light-table/ballEntryLifecycle.test.mjs`: RED caught fallback source-center offsets and the old fallback's missing contact/pop scale. Final GREEN 5/5. Fixtures execute current handlers and provide genuine measured choreography/orientation; pause, scroll, disposal, repaint-before-close and handoff assertions remain.

Final commands, exit 0:

```sh
node --test sketches/013-light-table/ballFlow.test.mjs sketches/013-light-table/ballScene.test.mjs sketches/013-light-table/ballEntryLifecycle.test.mjs sketches/013-light-table/dialogHandoff.test.mjs sketches/013-light-table/ballMotion.test.mjs sketches/013-light-table/ballSampling.test.mjs sketches/013-light-table/ballFollow.test.mjs
# 35 pass / 0 fail
node --test sketches/013-light-table/*.test.mjs
# 58 pass / 0 fail
```

`study.jsx` and `Volleyball.jsx` also passed installed Vite/Oxc transforms in memory; no build output was written. Scene tests use a stub WebGL renderer with real Three geometry/camera/quaternion/material/resource math. Handler tests use controlled DOM/React commits. These are node checks, not native pixel or browser acceptance.

Parent trace contract, available on the current frame:

- `.volleyball-view.dataset.entryTrace` JSON: `age`, `phase`, actual rendered world `position`, signed actual `velocity`, sampler `pathVelocity`, `clockVelocity`, `support` (null in air), `tangent`, `normal`, rolling `axis`, actual `corner`, `sourcePose`, `sourceRadius`, current pop-scaled `radius`, `distance`, `speed`, `rollingAngle`, full `quaternion`, logical `angularVelocity`, captured `card` including original affine and screen support/corner/tangent/normal, current `cardAffine`, `sourceAffine`, `contactShift`, `contactLayout`, actual `cameraPosition`/`cameraQuaternion`, projected center/diameter and backing `buffer` dimensions/DPR.
- `.volleyball-view.dataset.logicalOrientation`: retained quaternion, derivative, captured residual and last sampled age; available while the eligible controller runs even without a GPU. Logical state remains on `host.ballEntry.orientation` across release/reconstruction. `host.ballFlow.state` carries the actual clock/velocity.
- `.ball-entry.dataset.contactFrame`, `cardAffine`, `sourceAffine`, `contactLayout`, `flightTime` and `progress` expose actual DOM contact/frame and sampler clock for correlation with native captures.

The authored corner decelerates smoothly to a nonzero 15% of rolling exit speed; its angular travel is the integral of that speed on the actual radius. Air starts with that actual x/y velocity, and the backward anchor makes the unmodified ballistic endpoint exactly `[-3.45,2.62,0]`. Final radius is .92 on the existing top1.7. Landing camera stops at impact, allowing one visible bounce and rest.

Final target: desktop .40x/.55y, mobile .50x/.57y. Normal return preserves the complete quaternion through a compatible basis and keeps saved scroll exact. If resized height makes the CTA unavailable, focus goes to the existing `Show GameOnVB` navigation button, which has no focus-triggered scroll handler.

Step 3 cards-up and new gradient choreography remain the next pass. Existing air wash/deck fade uses the new air clock. Parent still owns native filmstrip, actual DOM support/shadow inspection, cross-viewport first-frame parity, perceived roll/corner timing, real resize and GPU/static lifecycle acceptance. No browser/build success is claimed here.

## Step 5 acceptance-probe writer — 2026-10-02

The preceding step 2 notes are historical. Step 3 native filmstrip and strict trace checks were already captured by the parent at 1440×1000, 390×844 and 320×780, 225 samples each. This writer began with read-only `git status --short`, preserved unrelated WIP and made only the following edits inside `sketches/013-light-table/`:

- `ball-flow.py`: replace raw Euler equality with actual `dataset.quaternion` angular distance (including equivalent signs/canonical Euler branches). Retain the .16s phase, .06rad/9rad/s orientation, position and .03 momentum watchdogs. Record full angular differences and compare the full angular vector, distance/radius rolling and the returned source bridge's finite-difference derivative on all three axes. Capture before/first/closed renderer/canvas/material identity and source framing/diameter parity.
- `ball-flow.py`: assert the 3.55s pop/contact/rolling/corner/freefall/landing/rest contract, actual projected support/radius and measured DOM corner within .02px, bounded accelerating speed, signed `pathVelocity × clockVelocity`, ballistic position/velocity, one upper-tread landing, complete outline, whole-fan upward travel without opacity or per-card motion, fixed camera orientation while any card remains visible, quarter-viewport upward bound and viewport backing at DPR≤1.5/≤4MP. Add native viewport resize at a deliberately paused rolling clock, exact same-phase/world-pose/quaternion repaint, resume and saved-scroll/navigation-focus return. Screen displacement comparisons apply within an unchanged viewport; resized world pose and orientation are checked exactly instead.
- `ball-flow.py`: capture contact/roll/corner/fall screenshots at current beat thresholds and bracket each screenshot with actual sampler/time snapshots. These are elapsed capture intervals, not claims of an exact threshold frame. Original native primary/modifier/middle/key/Escape/history/interrupted return, precise scroll/focus, modal exclusivity, native emulated touch, hidden/reduced, disposal, context loss, no-GPU and fresh-context cold-hash assertions remain. No forced or synthetic click was introduced.
- `ball-parity.py`: hold the actual dynamic Three prerequisite with `**/assets/three.module-*.js` (observed current build: `three.module-DXsC02Ky.js`) and report the held request URLs. The old scene-chunk request no longer occurs because study statically imports its narrow projection helper. Exact-model visible loading PNG, observed pending request, live GPU resumption and offsheet last-pose native capture assertions remain.
- `probeContracts.test.mjs`: execute the same pure check block used by the native runner. Pin equivalent quaternion representations, physical resets on each axis, actual source bridge derivative, broken contact/phase/speed/velocity/buffer/camera/fade contracts, full rolling angular velocity, nonballistic flight and loader targeting. Existing selection/tap waits are unchanged.
- `README.md`: narrowly replace the obsolete entry/bounce description with the current isolated choreography and acceptance limits.

Observed RED → GREEN:

```sh
node --test sketches/013-light-table/probeContracts.test.mjs
# Initial RED: exit 1, 2 pass / 4 fail (missing quaternion/bridge/trace checks and obsolete loader target).
# GREEN after implementation: exit 0, 6/6; extended focused contracts: exit 0, 8/8.
node --test sketches/013-light-table/*.test.mjs
# Exit 0, 99 pass / 0 fail.
```

Both changed Python files passed `ast.parse` without import or execution. The embedded trace/check JavaScript compiled in Node. Offline Node replay of the new frame/pair/orientation predicates against the parent's existing `filmstrip-20261002-161811/{1440,390,320}/trace.json` passed all 675 samples; it did not execute browser probes or establish a new native run.

Parent evidence read: `/Users/vitek/.hermes/cache/scratch/light-table-roll-work/filmstrip-20261002-161811/temporal-acceptance.json` reports PASS, maximum contact/corner error below .02px, rolling error ≤2.4e-13rad, upward travel 151/121/104px and camera rotation beginning after 2.50. `/Users/vitek/.hermes/cache/scratch/light-table-roll-work/regressions-20261002-162016/report.json` records the two fixture failures addressed here; its other ten probes, including the formerly pending `verify.py`, report exit 0. These are prior parent results, not writer reruns.

No source motion/camera/rendering, production code, dependency, browser, server, install, build, git mutation or sandbox setting changed in this pass. Fresh npm tests, typecheck and build were not run by this writer. Parent must rerun all final gates, both updated native fixtures and the full native regression matrix, verify protected source hashes/resources, and independently review the final code. Newly added native resize and return-bridge observations remain pending that run. Physical-phone performance and owner art approval are **NOT TESTED / NOT ESTABLISHED**; production integration remains deferred.

## Two native geometry/position defects — 2026-10-02 serial writer

Read current status/code and the parent's `/Users/vitek/.hermes/cache/scratch/light-table-ball-entry-work/browser-20261002-165203/acceptance.json`. Baseline Node: 106/106. All edits remain in this directory. These are reproduced application defects, not fixture failures.

`nativeGeometryReturn.fixture.json` retains measured card affines, support/corner, captured source/current poses and actual corner/return clocks from that evidence. Source width is recovered by inverting the captured support-screen point through the source affine (support is at source width/2); source height follows the captured projected radius, and aspect uses the original integer source backing dimensions. Fan bounds are the measured card bounds. The replay uses the exact trace age, not its rounded dialog display.

Observed RED:

- `node --test sketches/013-light-table/nativeGeometryReturn.test.mjs`: 0/3 passed. Exact captured 1000x900 corner reproduced left outline `-6.637378877px`; actual near-return reproduced the old ambient-position endpoint; all-axis current-source position comparison failed.
- `node --test sketches/013-light-table/ballScene.test.mjs`: 3/4 passed after adding 1000x900/768x1024 to the existing measured-layout checks and strengthening outline inequalities to strict viewport bounds. The 1000px rolling/corner outline clipped before support loss.

Runtime changes:

- `ballScene.js`: desktop contact translation now anticipates the projected captured support/corner/exit and pop-scaled radius. It moves ball and fan with the same smooth affine only if their ball outline would clip. Captured 1440px contact remains stationary; 390/320 tracking is unchanged. Native 1000px corner replay now has `38.781933096px` left clearance. Fixed source-world card basis, camera orientation handoff, whole-fan travel and world contact geometry are unchanged.
- `ballFlow.js`: optional current pose contributes `(current ballMotion position - captured source motion) * (1 - ballEase(age/.30))` only during pop. The first captured source frame is unchanged, the current normal position owns age zero on return, and offset and its age derivative vanish at .30. There is no want-flag branch, independent restart or contact/roll ambient position.
- `Volleyball.jsx`, `study.jsx`: the existing sole draw owner passes this same current pose to the exact-model fallback. Ordinary pointer following, ballMotion equations, spin/brush/damping, quaternion handoff and return clock were not changed.

Trace/probe semantic extension:

- Rendered `position` is read from the actual Three ball. `pathVelocity` is the age derivative with current ambient pose held fixed; `ambientVelocity` is the ordinary time derivative weighted by the pop bridge. Pointer position remains frozen during entry as before. Physical `velocity` is exactly `pathVelocity * clockVelocity + ambientVelocity`; contact and all later beats require exactly zero ambient velocity.
- `ball-flow.py` retains signed-clock, ballistic, angular, identity, contact/corner, full-outline, fall, resize, native-input and hidden assertions. Its pure checks now independently verify both pop derivatives and the pop position. A new `positionBridge` check compares the retained age-zero rendered trace against the ordinary repaint on every position/velocity axis at the actual close. No limits were loosened. No other Python probe or scroll/watch threshold changed.

Checks changed: `nativeGeometryReturn.test.mjs`, `nativeGeometryReturn.fixture.json`, `ballScene.test.mjs`, `ballEntryLifecycle.test.mjs`, `probeContracts.test.mjs`. Coverage includes strict bounds at 1440x1000, 1000x900, 768x1024, 390x844, 320x780 and 844x390 orientation resize; exact captured source projection; fixed card basis/contact radius; rendered finite-difference three-axis velocity; current source endpoint; interruption/reopen without a flag snap; fallback parity; and noncollision join speeds. The native last-open-frame replay is now `0.263510913px` from its captured ordinary repaint, and the age-zero source-camera projection matches exactly.

Final GREEN:

```sh
node --test sketches/013-light-table/nativeGeometryReturn.test.mjs sketches/013-light-table/ballScene.test.mjs sketches/013-light-table/ballEntryLifecycle.test.mjs sketches/013-light-table/probeContracts.test.mjs
# exit 0, 27/27
node --test sketches/013-light-table/*.test.mjs
# exit 0, 111/111
```

Changed `ball-flow.py` passed Python AST parsing without import/execution; its pure JavaScript checks ran in the Node contract tests. No browser, build, install, server, sandbox escalation or git mutation ran. Native pixels, final filmstrip, full native matrix, npm/typecheck/build and fresh read-only review remain the parent's final gates. Production and prior studies were not edited.

## Native source-position ownership — 2026-10-02 serial writer

Read current status, current handlers/tests and the parent's `browser-20261002-171139/acceptance.json` evidence. Baseline focused Node suite: 111/111. The App resize updater recomputed source position while the captured ball frame still owned the fan, changing child card poses despite frozen fan dimensions.

Only runtime edits: `study.jsx` guards the existing scroll/resize updater with `ballRestoreRef.current` and explicitly recomputes position from actual native `scrollY` and current viewport height after return restores saved scroll. Ownership lasts through return with `ballDesired=false`; initial `preference();update();sync()` order and renderer resize/repaint remain unchanged.

`dialogHandoff.test.mjs` executes the actual App updater and existing restore/land handlers with controlled position state. New cases cover paused entry and return through 320×780 → 390×844 → 844×390 → 1440×1000, unchanged source position/all three sheet poses/clock/orientation, same-Y return without a scroll event, exact saved 663px scroll, CTA versus navigation focus, and resumed ordinary scroll/resize. Existing style restoration, serial hash handoff, pause/controller/resource and strict .02px corner checks remain intact.

Observed RED: `node --test sketches/013-light-table/dialogHandoff.test.mjs` exited 1, 42/45 passed. Both paused resize cases changed position from 1 to .924170616; same-Y changed-height return retained 1 instead of .78. GREEN after the two runtime line changes: exit 0, 45/45.

Final commands:

```sh
node --test sketches/013-light-table/dialogHandoff.test.mjs sketches/013-light-table/ballEntryLifecycle.test.mjs sketches/013-light-table/nativeGeometryReturn.test.mjs sketches/013-light-table/ballScene.test.mjs sketches/013-light-table/probeContracts.test.mjs
# exit 0, 72/72
node --test sketches/013-light-table/*.test.mjs
# exit 0, 115/115
```

Node transcripts: `/tmp/light-table-source-position-{baseline,red,green,focused,all}.tap`. Only `study.jsx`, `dialogHandoff.test.mjs` and this document changed in this pass. No Python probe, fixture/tolerance, product layout, normal input model, watch flow, ambient return bridge or shared world projection was edited. No git mutation, browser, build, server, install, deploy or sandbox escalation ran. Parent must rebuild and rerun the full native matrix, paused orientation resize with strict actual-DOM corner checks, and final filmstrip. The unrelated existing `verify.py` raw-touch timing failure remains unclassified without parent baseline proof.

## Interrupted rolling RETURN → REOPEN angular derivative — 2026-10-02 serial writer

Read current status/source and independently ran the parent's `angular-crossing.mjs` using the unchanged actual `nativeGeometryReturn.fixture.json` entry-return geometry/pose. The persistent return omega was discarded when clock velocity changed sign; distance-only forward rotation restarted near a stopped clock. This reproduced the same defect in the quaternion's world derivative, not merely its advertised angular vector.

RED `rollingReopen.test.mjs`: the finite-difference quaternion derivative gap was **2.134946315857338 rad/s at dt=.0167** and **2.1483725756986947 rad/s at dt=.001**. Rolling, settle, corner and missing logical transfer assertions failed. The later native semantic test also failed against the old pure-path predicate (`rolling quaternion slips`), establishing that it needed to verify the explicit transient rather than weaken its existing tolerance.

Runtime changes are limited to `ballFlow.js` and the `ballScene.js` trace:

- Persist the previous physical clock velocity on the existing entry orientation, updated only for positive dt. At an interrupted negative-to-nonnegative clock crossing retain the carried vector as `orientation.reopen={velocity,elapsed}` relative to the forward target. Age zero at the terminal return remains a return sample.
- Transfer this one residual for .32 physical seconds with weight `1-3u²+2u³`. Integrate its exact travel `.32*(u-u³+u⁴/2)` into the quaternion increment alongside the exact signed distance/radius path vector. Advertised omega is the forward target plus the same decaying residual. Expiry removes the state and restores the original strict pure rolling branch. All axes are retained; source brush/damping and ordinary forward entry remain unchanged.
- Keep the transfer in pop, settle, corner and air. If support loss happens during a transfer, rebase its remaining carried vector against the air target so the corner/air endpoint also retains the derivative, including an exact age=1.85 sample (separately RED → GREEN). A subsequent return carries current omega with the original dt*8 smoothing and removes the transient target; it never multiplies spin by the faster return clock.
- Expose `reopen` in the actual rendered entry trace. No position, world basis, camera, card/source resize ownership, style restoration or resource controller changes.

GREEN quaternion derivative gaps are **.10756433241917929 rad/s at dt=.0167** and **.000020981572586897812 rad/s at dt=.001**. The unchanged parent scratch script now reports omega.z **2.2828115586669795 → 2.2667804200775956** and **2.158446602080632 → 2.158383792605083**, respectively.

Checks changed: new `rollingReopen.test.mjs`, `ballEntryLifecycle.test.mjs`, `probeContracts.test.mjs`, and `ball-flow.py`. They cover actual fixture crossing derivatives, pop/settle/corner/air axes, corner-to-air transfer, original .06/dt*9 bounds, finite transfer expiry, strict post-transfer distance/radius quaternion and kinematic omega, dt-zero freeze, JSON logical reconstruction, and the actual effect's hidden/reduced recreation/resume. Existing bounded full-return and ordinary forward rolling tests remain unchanged.

The Python pure pair predicate now independently verifies residual vector persistence, its elapsed clock, compact decay and integrated quaternion composition during advertised transient rolling. It retains the existing .001 quaternion and 1e-10 angular-vector checks and immediately requires pure rolling when the transfer ends. Mutations to every angular axis, residual vector, decay time, early removal and path distance are rejected. The new `reopenCrossing` predicate finite-differences rendered quaternion intervals and vetoes the original distance-only jump. The added parent-run native scenario uses an actual CTA, Escape, history Forward, and Back; it waits for rolling return velocity ≤-1 and requires exactly one recorded rolling zero crossing with a residual. Cold-hash contexts and other actual-input/invariant cases are unchanged.

Final verification:

```sh
node --test sketches/013-light-table/rollingReopen.test.mjs sketches/013-light-table/ballFlow.test.mjs sketches/013-light-table/probeContracts.test.mjs sketches/013-light-table/ballEntryLifecycle.test.mjs
# exit 0, 45/45
node --test sketches/013-light-table/*.test.mjs
# exit 0, 125/125
```

`ball-flow.py` passes AST parsing without import/execution; Node executes its actual embedded JavaScript checks. Exactly seven files changed in this pass: `ballFlow.js`, `ballScene.js`, `ball-flow.py`, `rollingReopen.test.mjs`, `probeContracts.test.mjs`, `ballEntryLifecycle.test.mjs`, and this document. No writes outside this study, git mutation, install, build, server, browser or sandbox escalation ran. Parent rebuild, full native matrix including the new zero-crossing observation, final filmstrip and final read-only veto remain required. Production integration remains deferred.


## Two orientation-resize geometry defects — 2026-10-02 serial writer

Read `git status --short` first, then the completed angular fix and the parent's `browser-20261002-173027/acceptance.json`: `same-phase-resize` and top-level `paused_native_resize`. Baseline Node: **125/125**. Only this study was edited; angular/momentum/clock and current-pose bridge code did not change.

`orientationResizeGeometry.fixture.json` captures the native 320×780 source affine, fractional dimensions 215.062×183.703, original 215/184 backing aspect, all-fan bounds, pose/card/world basis, exact failing age **2.635257349999995** (also tested at **2.63526**), and three actual paused-resize corners. The -190px sticky-parent origin is attributed to the parent's defect report. Dimensions come from the measured support inverted through its affine and captured diameter; the captured native world basis matches independently within 1e-9.

RED command: `node --test sketches/013-light-table/orientationResizeGeometry.test.mjs sketches/013-light-table/probeContracts.test.mjs`, exit 1, **10/14 passed**. The replay reproduced **31.40111838787311px** fan reentry and **-189.99999999999997px** DOM ancestor displacement. The old native rolling predicate also accepted the displaced corner, establishing its missing location check.

Runtime changes:

- `ballScene.js`, only `ballFanFrame`: conservatively bound every orientation in [0,1] using 32 intervals. Rotated fixed-world bounds use angular speed `2*theta` times vector length: half-interval padding `length*theta/32`. Monotone clip weights are bounded at interval endpoints; their product intervals form a constant projected numerator envelope. Its safe departure is found with 28 bisections; orientation then eases continuously from zero to one at 3.02. The envelope divided by growing span decreases while the fan travels upward, preventing reentry. A resized clip's additional clearance deficit (plus .02px) is reached by the authored .95s travel endpoint, 2.80, using smoothstep over 2.15–2.80. The first readable .3s of fall and ball/model center path stay unchanged. No rebase, fade, duplicate, per-card transform or camera engine. Forward/return share this stateless geometry; resize uses the same fixed source basis.
- `study.jsx`: capture the sticky parent origin once, measure its current rect every paint, and convert the one global fan affine into that parent frame with the captured/current origin delta. Camera, source metric and trace remain global. Existing exact inline restoration, frozen index, responsive return and native scroll ownership remain intact.
- `ball-flow.py`: sample `view.projectEntry(trace.corner)` and compare against the measured actual DOM corner at strict `<.02px` during rolling and corner contact. Paused native resize already runs this frame predicate. All existing position/clock/quaternion, support/radius, visible-card camera, buffer, input, hidden, serial handoff and focus assertions remain. No other Python probe changed.

`orientationResizeGeometry.test.mjs` independently scans the entire orientation interval with Three's camera quaternion; checks onset/progress, full outlines and fixed metrics across six viewports; and executes actual DOM paint with measured parent rects. `ballScene.test.mjs` runs the actual camera/projector forward and backward through native resize, including paused rolling world-corner projection. Its obsolete orientation-zero exit expectation now requires clearance before the full handoff envelope's departure; camera safety limits were not loosened. `dialogHandoff.test.mjs` and `ballEntryLifecycle.test.mjs` supply parent rects and retain prior assertions. `probeContracts.test.mjs` rejects the 190px displacement and .0201px corner errors.

GREEN focused: **29/29**, exit 0. Final command: `node --test --test-reporter=spec sketches/013-light-table/*.test.mjs`, **128/128**, exit 0. `ball-flow.py` passes AST parsing without import/execution. Angular derivative gaps remain **.10756433241917929** (dt=.0167) and **.000020981572586897812** (dt=.001), unchanged. These are Node/harness results, not fresh native pixels.

Paused-resize acceptance coordinate correction (2026-10-02): only `ball-flow.py`, `probeContracts.test.mjs`, `responsiveReturn.fixture.json` and this note changed. Hash verification found all 24 runtime/assets files byte-identical, existing geometry fixtures unchanged, and every other Python probe unchanged. The prior native matrix was 11/12 PASS; its ball-flow failure compared the pinned 320x780 captured source projection with the responsive 1440x1000 normal source after restoration.

TRACE now records actual view frame, surface dimensions, DOM source/card bounds and matrix, captured source viewport/geometry, native normal projection, and exact style/scroll/focus restoration. The actual executable CHECKS records `responsive_relayout` only for an ENTRY-to-SOURCE handoff with both a changed captured/current viewport and proven source frame/DOM geometry differences. Every other pair retains the original same-viewport `max(40, elapsedMilliseconds*6)` screen watchdog, clock, quaternion and spin checks. Every source handoff also checks the exact age-zero position/velocity and quaternion/angular bridges, bounded near-end world integration, view/material/canvas identity, exact native scroll/focus/styles, and normal local/DOM framing within the original 1px bound.

RED: `node --test sketches/013-light-table/probeContracts.test.mjs`, exit 1, 12 PASS / 2 FAIL (missing executable screenPair check). GREEN: focused 14/14; `node --test --test-reporter=spec sketches/013-light-table/*.test.mjs`, exit 0, 131/131; all 13 Python probes AST-parse without import/execution. Existing 128 Node proofs remain intact. Mutations reject broken world pose/velocity, quaternion/angular bridge, normal framing, clocks, canvas/view/connection/count/material, spin and scroll/focus/styles; the unchanged-viewport ~17.6px world-jump regression remains rejected.

Recorded native replay: geometry difference 387.938px; near-end world gap .0027624835586819146; position bridge error 8.708321568341925e-16, velocity error 0; quaternion bridge error 1.676859480936124e-16; angular velocity errors at most 1.266900101562496e-7. `responsiveReturn.fixture.json` explicitly labels reconstructed geometry and restoration harness inputs because the old native trace predates the new fields. These results are CHECKS replay, not fresh native observation. After real viewport changes, normal responsive source reflow is not claimed pixel-stationary.

Parent: runtime rebuild is unnecessary for this source-unchanged pass; rerun all acceptance gates and the full native matrix against the updated probe, including the paused-resize restoration and all input/lifecycle fixtures. This writer ran no browser/server/install/git mutation. User art approval and physical phone acceptance remain pending.

Ten changed paths, all here: `ballScene.js`, `study.jsx`, `ball-flow.py`, `ballScene.test.mjs`, `ballEntryLifecycle.test.mjs`, `dialogHandoff.test.mjs`, `probeContracts.test.mjs`, `orientationResizeGeometry.fixture.json`, `orientationResizeGeometry.test.mjs`, and this document. No browser, server, install, build, git mutation, deploy, sandbox escalation or delegation ran. Parent's unchanged `verify.py` retry evidence remains `/Users/vitek/.hermes/cache/scratch/light-table-proof-20261002-172133/`; this writer did not rerun it. Parent rebuild, ball-flow/full native matrix, final filmstrip and focused read-only veto remain pending.
