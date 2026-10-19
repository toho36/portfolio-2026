# Arena → Goal Loop → Screen Switch → Playground

## Current local delivery: T1–T5

The reviewed final media are installed locally: 30 verified files, with 16 replaced originals backed up and 14 new files added. Four idle states per camera now use genuine 48-frame, 24 fps, two-second renders at 3584×2016 desktop and 1800×3200 portrait, 32 samples. GameOn uses the lowered frame112 cloth with the preserved frame84 reading camera. A contains 108 frames; the corrected, real-Lab-composited B contains 80 frames. A/B travel retains native 1600×900 or 900×1600; forward C–E, intro, Playground and peek assets remain unchanged. All five return paths have real reverse clips.

The straight finished belt and existing leaves move without restarting their stories. The shared controller accepts Next at any idle phase; reverse B now reveals its incoming hold after old-blend cleanup. Verification: 153 Node tests, 144 Python tests, 32 actual browser transitions, 14 three-cycle idle measurements, 48 lifecycle/input scenarios and six real HTTP404 fallback scenarios. Desktop and portrait were exercised in owned headless Chrome, not a physical phone. Opus 5.5 approved the current technical candidate and the decoded-motion evidence; subjective owner art approval is separate. The preserved portrait crop shows only part of the plant. Its visible contour motion was measured, not inferred from a video clock.

Seven supplemental screenshot continuity checks remain recorded as FAIL because capture crossed a native loop seek. They are not product PASS claims; separate screenshot-free windows verified real loop wraps, and decoded-media ROI/seam measurements supplied the motion evidence. No claim is made for every browser, physical-device frame pacing or bitwise MP4 closure.

Evidence and original backups: `/Users/vitek/Documents/agent-runs/portfolio-2026/2026-10-15-hero-brainstorm/arena/ambient-holds/refinement/hd-delivery/`. The approved render batch used 488 native frames and 22592.483298 seconds, within its 512-frame / 8-hour / 20-GiB limits. This is local study work only: no homepage change, commit, push or deploy.

## Historical phase notes, superseded by the delivery above

The remaining notes preserve earlier source-only checkpoints, preview provenance and historical commands. Statements about missing media or unapproved rendering describe those earlier phases, not the current delivery. Do not run the legacy encoder to regenerate the current A/B boundary or overwrite the new media; the current application receipt is `hd-delivery/application/applied.json` in the evidence folder above.

**Refinement status: T2/T5 player source only.** The controller selects five real reverse segments and four idle sources, with bounded decoded-pixel handoffs. This slice changes no media. Final GameOn112, finished-belt and plant media, sharp overview media, assembled desktop/portrait playback and final review remain pending owner-approved rendering and parent assembly. Missing files use the existing truthful error/static-poster fallback. Source tests do not establish native, browser or art acceptance; the proposed render budget remains unapproved.

The installed media still use the original 24 fps journey with six stops: 1, 84, 228, 468, 660, 804. Segments are **A: 1–84**, **registered B: 85–168** (84 existing-pixel composites, 3.5 seconds, ending at actual Lab228), **C: 229–468**, **D: 469–660** (192 frames, 8 seconds), **E: 661–804** (144 frames, 6 seconds). The accepted arena, banner cloth, lighting and camera samples through 168 are preserved; its cloth cache remains 1–168. Installed GameOn and overview idles remain the old 48-frame previews. T5 source also maps stop3/4 to their distinct pending idle files; stops0/5 have no idle. Parent must replace the A/B boundary and matching poster/idle with the admitted GameOn112 assembly before judging the new seam.

Goal Loop is an isolated white industrial lab at x=600, hidden through 168. The fixed wall hole is present from the first lab frame. At Build a small two-slot tray holds two physical repair joiners. The waiting outline at Plan, loop and goal are framed together in the oblique mobile overview, below the calm upper reading area. The camera pulls back faster immediately after 169 and the entry panel withdraws by 181; an edge crosses the frustum by 174. Accepted arena cameras, lighting, exposure and cloth are unchanged.

Check presses at 303–306 and opens a physical jagged fracture at 304. Its red glow dims by 316, leaving a dark gap. The same slab returns around the loop. Build takes one U-shaped joiner from the tray at 378–382, inserts it at 384–388 and closes the matching fracture. One joiner stays in the tray; the inserted joiner remains a small amber corner mark on either face of the slab. Check presses the same place again at 420 and holds green. Review measures at 438–442, parks its gauge by 446 and confirms the fit. The stationary slab turns to glass at 446–448, holds on the exit belt at 448–456, then slides through at 456–464 and stays beyond the hole through 468. Camera contacts are held; the return uses one wide view. Final pane centre is (-2.75,5.1,1.1); a narrow reflection strip, dark receiving niche and visible air inside the reveal distinguish the same finished piece from the goal frame.

Robot flanges, grippers, tool heads and joint rings are dark. The satin chassis has a separate material from the graphite belt. Orange belongs to the delivery piece; repair joiners are amber brass. `blender/goal_loop.py` provides pure geometry/timing; physical fracture geometry, tray, joiners and materials are assembled in `build_scene.py`. No new physics is used.

## Parent previews only

The worker does not run Blender. Parent preview command, repeated with `mobile` in both camera and output path:

```bash
/Users/vitek/Applications/Blender.app/Contents/MacOS/Blender -b -P sketches/033-arena/blender/build_scene.py -- --out /Users/vitek/Documents/agent-runs/portfolio-2026/2026-10-15-hero-brainstorm/arena/goalloop/preview5/desktop --preview --stills --frames 169-468 --camera desktop
```

Preview 169/174/200/228 first; compare 169 against accepted 168, then check the first lab edge, Plan, tray and fixed hole in both aspects. Next inspect 304/316 (glow to dark gap), 378/382/386/388 (pickup and insertion), 420 (same Check), 442/446/448/456 (Review, glass conversion and hold), then 458/468 (pass and identity). The `--stills` list includes these. Short sequences 169–180, 298–316, 372–392 and 438–468 are necessary to judge actions and pacing. Render brightness, occlusion, glass/reflection appearance and mobile readability remain parent checks; projection tests alone cannot establish visual acceptance. Parent runs save the scene and a manifest of actual event ranges. Stops through Goal Loop remain 1/84/228/468; preview sizes are 640 × 360 / 360 × 640, final sizes 1600 × 900 / 900 × 1600.

## Screen Switch: parent-only final delivery

The approved home-office continuation preserves the original pane and amber U joiner, camera path, two monitors, single window exchange, framed prints, plant and lamp. Art and choreography remain frozen. `build_screen_switch.py` opens each accepted camera-specific native scene with embedded scripts disabled, appends the continuation, checks the original transforms/visibility at 1/169/468/469 and keys through 468, then saves a separate scene. Source SHA256 and fresh-output guards remain active in both modes.

Modes are explicit and mutually exclusive. `--preview --stills` remains capped at eight frames, 640 × 360 / 360 × 640, 8 samples and motion blur off. `--final` defaults to exactly 469–660, 1600 × 900 / 900 × 1600, 32 samples, inheriting accepted AgX, exposure, motion blur and shutter. Optional final `--frames` must be ordered, unique and inside 469–660; `--final --stills` is rejected. Omitting a mode cannot render. The manifest records actual mode, frames, dimensions, samples, motion blur and shutter; it does not certify visual acceptance.

Parent commands from the repository root (each output directory must be fresh):

```bash
arena_run=/Users/vitek/Documents/agent-runs/portfolio-2026/2026-10-15-hero-brainstorm/arena
for camera in desktop mobile; do
  /Users/vitek/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python-exit-code 1 \
    --python sketches/033-arena/blender/build_screen_switch.py -- \
    --source "$arena_run/seam-fix/render/$camera/arena.blend" \
    --icon "$arena_run/screen-switch/preview-01/rectangle.2.swap.png" \
    --out "$arena_run/screen-switch/final/render/$camera" --camera "$camera" --final --frames 469-660 || exit 1
done
```

The accepted Screen Switch media through 660 is already present. The worker does not run Blender or the encoder. New Playground motion quality and actual six-stop desktop/mobile playback remain parent verification tasks. Physical-phone evidence remains unverified.

## Playground: parent-only final delivery

The approved preview03 art remains frozen: one genuine existing study032 villa sequence in left window B, the camera approach through 732 and hold through 804, original UV/reveal, office lighting and right pane/joiner. The static unpacked 145-file timeline starts at 660 with zero offset and no offset F-curve: source156 holds through 743, the existing 156–192 finish runs at 744–780, then source192 holds. No source images or old scenes are rewritten.

`build_playground.py` requires mutually exclusive `--preview` or `--final`. Preview still requires `--stills`, defaults to 660/684/708/732/744/756/780/804, and retains its eight-frame cap, 640 × 360 / 360 × 640, 8 samples and blur off. Final rejects `--stills`, defaults to exactly 661–804 (144 new frames per camera), and uses 1600 × 900 / 900 × 1600, 32 samples, inheriting the sealed source's motion blur, shutter and color management. Optional final `--frames` must be ordered, unique and inside 661–804; malformed or oversized ranges are rejected before expansion. Fresh output basenames must match `preview-{camera}` or `final-{camera}`, separate from all inputs.

`--prepare-only` is available in both modes: it saves the guarded scene and truthful manifest with `render_status: prepared_pending_reload`, empty rendered-frame evidence and no PNGs, then returns. The manifest records actual mode, dimensions, samples, blur, shutter and requested frames; it does not certify native reload, pixels or motion. Parent prepares each final camera in a fresh destination:

```bash
arena_run=/Users/vitek/Documents/agent-runs/portfolio-2026/2026-10-15-hero-brainstorm/arena
for camera in desktop mobile; do
  /Users/vitek/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python-exit-code 1 \
    --python sketches/033-arena/blender/build_playground.py -- \
    --source "$arena_run/screen-switch/final/render/$camera/screen-switch.blend" \
    --frames-root "$arena_run/playground/villa-timeline" \
    --out "$arena_run/playground/final/final-$camera" --camera "$camera" --final --prepare-only || exit 1
done
```

Parent then freshly reloads each saved final scene with a parent-owned final operator, verifies native guards, static sequence/file SHA mappings, inherited blur/shutter/color and final settings, and renders only 661–804 once per camera (288 frames total). The existing runfolder `render_prepared.py` is hardcoded for preview03 and eight cheap stills; it is not a final-render command. Full-quality reveal at 662–684, continuous motion and the dark unlit portrait villa remain actual-image checks. The earlier strict mobile-late approximate NN FAIL remains a measurement limitation; independently verified preview source192 is not a substitute for final native-clock verification. No additional art or preview-repair budget is reopened.

## Encoding and player

The generic `encode.sh` below retains the legacy raw **B: 85–228** mapping. Running it can regenerate that legacy B; it does not produce the canonical registered B or either current waiting loop. The earlier GameOn compositor pipeline below documents the existing B/peek provenance. Current loop integration reuses the four exact MP4s listed under “Ambient holds” and runs neither encoder nor compositor; preserve A–E, both peeks and every existing poster.

`bash sketches/033-arena/scripts/encode.sh RENDER_ROOT MEDIA_ROOT` accepts a combined root with `desktop/` and `mobile/`, each containing `frame-0001.png` through `frame-0804.png`. Parent assembles that root using accepted 1–660 and actual new 661–804; do not overwrite the accepted render folder. WebP stills map to 1/84/228/468/660/804. H.264 segments A/B retain a 1,200,000-byte cap, C a 2,000,000-byte cap, D a 1,600,000-byte cap, and E adds a 1,200,000-byte cap. The existing bounded CRF/VBV retries, endpoint keyframes and cwebp fallback remain. Always supply a task candidate MEDIA_ROOT, then copy only the two new files per camera into the study, preserving all 18 existing camera assets plus the native icon:

```bash
bash sketches/033-arena/scripts/encode.sh "$arena_run/playground/final/combined" "$arena_run/playground/final/media" || exit 1
for camera in desktop mobile; do
  cp "$arena_run/playground/final/media/$camera/segE.mp4" "sketches/033-arena/media/$camera/segE.mp4"
  cp "$arena_run/playground/final/media/$camera/stop-5.webp" "sketches/033-arena/media/$camera/stop-5.webp"
done
```

Story assets: `media/{desktop,mobile}/{poster.webp,stop-1.webp,stop-2.webp,stop-3.webp,stop-4.webp,stop-5.webp,segA.mp4,segB.mp4,segC.mp4,segD.mp4,segE.mp4}` are already present. No encoding was run by the integration worker and existing media is untouched. The sixth stop uses the same controller, lab copy band and native input/fallback behavior, with factual copy “Playground / Studies and experiments.” Screen Switch retains its native icon.

The HTML poster owns first paint; only its successful decode allows the next segment to preload, outside reduced motion. A move fades the copy out in 150 ms before playing. Destination stills replace the last valid still only after decode succeeds. Every forward/reverse segment retains its final valid video pixels while the destination still decodes, including when that decode fails; new travel is gated during the pending decode. Skip always stops the film, retains the destination-or-current still and focuses/scrolls to following content. Escape finishes at the destination still and focuses the hero. During movement wheel/touch remain native and a strong downward gesture skips. Errors, genuine play rejection, a two-second stall and offstage scroll settle through the same decoded destination poster in both directions, retaining any visible film frame until decode and starting no idle or next preload. Failures keep the error readable and Next/Skip usable after settling. If the target poster also fails, navigation returns to the last decoded still's chapter; that still keeps its matching alt/copy/count, or a retained travel frame stays visible with chapter copy/count suppressed and an unavailable announcement. Hidden documents pause and returning settles statically. Copy returns after successful completion; lab stops use dark text on a translucent white band (worst-case paragraph contrast over black is >8:1). Action captions use “Actor: finding”. Reduced motion uses stills. Normal Prev, ArrowUp/PageUp, wheel-up and downward touch swipe share the reverse playback path, retain the origin chapter until playback completes and resume the existing eligible idle only after the target poster decodes. Reverse C maps elapsed frames from468 down to229; forward C remains229 up to468. Film listeners and play rejections are guarded by source, revision and attempt.

### T2 reverse media handoff (parent only, not executed)

Each camera requires `segA-reverse.mp4`, `segB-reverse.mp4`, `segC-reverse.mp4`, `segD-reverse.mp4`, `segE-reverse.mp4` in `media/{desktop,mobile}/`. Reverse uses ordinary positive-rate playback of these files. Derive them from the explicitly selected final canonical clips, **after T1 establishes the A/B boundary**; registered B must never be replaced by legacy raw B from `encode.sh`. No final A/B reverse encoding is authorized by this source slice.

Example for one explicitly selected canonical clip and a fresh parent-owned candidate directory (repeat for A–E and both cameras; no study media is overwritten):

```bash
# Set canonical_clip, reverse_dir and segment explicitly in the parent's run folder.
test -f "$canonical_clip" && test ! -e "$reverse_dir" || exit 1
mkdir "$reverse_dir" || exit 1
ffmpeg -hide_banner -loglevel error -n -i "$canonical_clip" -map 0:v:0 -an \
  -vf 'reverse,setpts=PTS-STARTPTS' -c:v libx264 -preset slow -crf 25 \
  -maxrate 2200k -bufsize 2200k -pix_fmt yuv420p -movflags +faststart \
  "$reverse_dir/$segment-reverse.mp4"
```

The parent must probe dimensions, fps, frame count, duration and byte sizes, fully decode each output, verify reversed endpoints and readable intermediate pixels against the actual canonical clips, then verify source → study → build → served SHA identity. The existing forward byte caps remain a useful target (A/B/E1,200,000; C2,000,000; D1,600,000); the example does not certify those caps. Preserve both camera variants, native sharpness and the selected T1 seams. Actual native inputs through all five returns and the forward six-stop journey, captions, idle arrivals, no black gap/old-poster flash, reduced motion and interruptions still require assembled desktop/portrait browser proof. No encoding, browser, build or render ran in this source slice.

## GameOn hold: earlier final pipeline (historical, parent only)

This records the earlier 96-frame final render and B/peek compositor contract. Its original generator, inputs, approval SHA records and outputs remain untouched. These are historical commands, not the current integration procedure or authorization to render again. Current GameOn loop bytes are replaced only as specified in “Ambient holds” below; B and peek stay byte-identical.

Owner approval is `gameon-hold/final/OWNER-APPROVAL.json` in the existing arena run folder. The parent reloads the exact approved prepared scenes, changes only dimensions/samples, and renders **84–131 once per camera: 96 new frames total, 24 fps, 32 samples, 1600×900 / 900×1600**. The Blender builder and pure art/math remain preview-only and frozen. Do not change the byte-identical preview `gameon-hold/inputs.json` to authorize final renders.

Each completed `native-manifest.json` must have `kind: gameon-hold-native-final`, the original source SHA, unchanged inputs SHA, `owner_approval_sha256` matching the exact approval file, exact ordered frames/rendered SHA rows, fixed camera dimensions/settings, `closure_key_not_rendered: 132`, and false prepare/rebake/handler flags. The CPU command rejects other approvals, input-registry changes, partial/excess frames, image/hash mismatches, arbitrary overrides, existing outputs and overlap with protected inputs:

```bash
hold_run="$arena_run/gameon-hold"
python3 -B sketches/033-arena/scripts/compose_arena_hold.py --final \
  --approval "$hold_run/final/OWNER-APPROVAL.json" --inputs "$hold_run/inputs.json" \
  --desktop-loop "$hold_run/final/native/desktop" \
  --mobile-loop "$hold_run/final/native/mobile" --out "$hold_run/final/derived"
```

Native directories above are parent-selected fresh batch paths. The derived manifest supplies per-camera encoding argv using existing libx264 (CRF25, slow, VBV2200k, yuv420p, faststart, endpoint keyframes) and cwebp80. Loop input is native 84–131; travel input is derived 85–168; peek input is the same real Lab228 ROI atlas, 640×360. Compositing math/clipping is unchanged, and travel PNG168 and `lab-228.png` retain exact source Lab228 bytes. Encodes are lossy; they require parent probing, decoding and visual checks.

Parent encodes into the fresh derived camera folders, measures **loop ≤600,000 bytes; B ≤1,200,000; peek ≤120,000**, and uses the existing bounded bitrate reductions (×0.8, minimum300k) or lower WebP quality if needed. Commands in the manifest are initial attempts, not evidence that caps passed. Back up the original B in the existing run folder before applying only `gameon-hold.mp4`, `gameon-peek.webp` and replacement `segB.mp4` to `media/{desktop,mobile}/`. Retain original `stop-1.webp`; do not apply derived `poster.png` or rewrite any other main media.

## Ambient holds: installed preview provenance (parent applies media)

Owner instruction “tak muzes impl” is recorded in `ambient-holds/integration/OWNER-APPROVAL.json` under `/Users/vitek/Documents/agent-runs/portfolio-2026/2026-10-15-hero-brainstorm/arena/`. The canonical reuse manifest is `ambient-holds/encoded-clips.json`. Its four already approved native preview loops each contain 48 frames, 2 seconds at24fps, rendered at8 samples, desktop640×360 / mobile360×640. These are the accepted preview pixels, not new HD/32-sample renders or upscales. Integration uses zero new rendered frames.

Source paths below are relative to that arena run folder; destinations are relative to this study. Parent backs up only the two existing `gameon-hold.mp4` files in the existing integration run folder, then performs exactly these four media effects with the existing encoded bytes:

| Existing source | Study destination | Bytes | SHA256 |
| --- | --- | ---: | --- |
| `ambient-holds/preview/media/desktop/gameon-ambient.mp4` | `media/desktop/gameon-hold.mp4` (replace) | 104334 | `c4b3f5ac9e39680a00d7bb3965447af6497d0b803aa19dd4432616f1d53794db` |
| `ambient-holds/preview/media/mobile/gameon-ambient.mp4` | `media/mobile/gameon-hold.mp4` (replace) | 78061 | `efb94f5773629755d9f7e10bb562b03f4d8228853bdeb815c755f5c420bb2ab0` |
| `ambient-holds/preview/media/desktop/goal-loop-ambient.mp4` | `media/desktop/goal-loop-hold.mp4` (add) | 50281 | `c34a17ddcdc5d2a8bbe6d100798c38ff9e05e023fb838a3228af5ae26854fbc0` |
| `ambient-holds/preview/media/mobile/goal-loop-ambient.mp4` | `media/mobile/goal-loop-hold.mp4` (add) | 45265 | `ba42a5a0f36c2e19c3f31b83d49c983c96023733ad6c496169d984f0c6082cb0` |

These historical preview effects preserve registered B, C, A/D/E, every poster, both existing GameOn peeks and the icon. Neither the legacy encoder nor the historical compositor regenerates these current loops. Final media application and actual byte verification belong to the parent, after fresh render approval.

The six-stop `main.js` controller reuses one existing hold wrapper and one muted ambient video. `idleName` maps stop1 to `gameon-hold.mp4`, stop2 to `goal-loop-hold.mp4`, stop3 to `goal-loop-finished-hold.mp4`, and stop4 to `screen-switch-hold.mp4`, in both camera directories. Stops0/5 have no idle. The last two files are absent; no unrelated clip substitutes for them. An idle plays only after the correct poster decodes, while visible/onstage with motion allowed. Once outgoing held pixels are released, actual travel may prime the destination source paused; priming does not display it or advance a chapter.

Next/Prev pauses the current ambient at its actual phase, including the current CSS peek reveal. Retention applies only to an active current-chapter hold owned by the current revision and variant, with a decoded current poster base; a static fallback cannot resurrect an older hold. After the existing 150 ms copy departure, the requested forward or reverse film starts normally. A bounded `requestVideoFrameCallback` readiness chain rearms after rejected frames, keeps only one callback outstanding and stops after accepting one decoded frame, cancellation or the two-second timeout. The fallback probes `playing`/`seeked`/`loadeddata`/`timeupdate` with decoded-current-data and seek/source guards. Readiness reveals the film beneath the retained current hold. CSS fades that wrapper out over120 ms, then releases it for destination priming. All five reverse MP4s still play spatial travel; there is no loop-completion wait, exit rewind, second ambient video, canvas, generated bitmap, RAF or interval controller. The layer overlap uses existing pixels and adds **0 native frames**. Layout, copy, controls and camera84 cover homography are unchanged.

For the pending T1 assembly, forward A must end with admitted arrival frames1–24 only; arrival24 is loop frame1/phase0. The player primes/starts GameOn at loop frame2, time1/24 at24fps, and switches to that decoded frame without an incoming fade or a second phase0 poster dwell. It never seeks/samples arrival25+ as idle. The film remains valid while its poster/idle decode. Forward peek retains the native gradual1500 ms reveal on the settled hold. Reverse B starts GameOn idle at phase0, decodes the Lab peek and sets it fully visible before a120 ms incoming blend releases retained terminal film pixels. Peek failure/stall leaves truthful retained film and usable navigation. Other idle entries retain a decoded poster base until the idle frame arrives, then use a120 ms settle blend to avoid texture/first-frame flashes. Actual decoded seams remain a parent browser/art gate with the final assets.

Only GameOn requests the decorative peek, with the unchanged native84 cover-crop projection. Reduced motion uses static posters and the fully decoded GameOn peek, with no loop or animated handoff; initially it requests no movies. Preference changes clear loop URLs and obsolete attempts without hiding a decoded peek; visible final travel pixels defer film removal until destination decode. Hidden/offstage pauses preserve idle time and visible reveal time. Revision/source/variant/attempt guards and canceled listeners, video-frame callbacks and timers reject obsolete readiness/decode continuations after navigation, Escape/Skip, suspension or preference changes. Frame readiness and reverse peek decode have a two-second bound. Existing poster-failure truth guards and shared keyboard/touch/wheel/Skip/Escape routing remain. No new DOM, framework, dependency, manifest fetch or observer is added.

Worker tests cover the real `main.js` handlers and pure receipt admission. Parent must assemble/verify final media, build the candidate, prove all six stops, all four idles, arbitrary-phase forward/reverse transitions and reduced/visibility/error/input behavior on desktop/portrait, and obtain fresh review before any final outcome. New rendering still requires explicit owner approval. Native rendering, compositing, encoding, browser/server execution and delivery remain outside this source slice; mocks do not establish final motion or physical-phone proof.

## Static verification

```bash
node --test sketches/033-arena/model.test.mjs
node --test sketches/033-arena/arena-hold-preview.test.mjs sketches/033-arena/ambient-preview.test.mjs
python3 -B sketches/033-arena/blender/test_ambient_holds.py
python3 -B sketches/033-arena/blender/test_arena_hold.py
python3 -B sketches/033-arena/blender/test_playground.py
python3 -B sketches/033-arena/blender/test_screen_switch.py
python3 -B sketches/033-arena/blender/test_goal_loop.py
bash -n sketches/033-arena/scripts/encode.sh
npx --no-install vite build --config sketches/033-arena/vite.config.js
git status --short -- sketches/033-arena/
```

Vite output: `/Users/vitek/Documents/agent-runs/portfolio-2026/2026-10-15-hero-brainstorm/arena/goalloop/build/`. The sandbox may block writes there; parent must run the production build with the actual assembled media. Static checks do not establish Blender runtime success or visual acceptance. Integration is limited to this study; no production-route integration, commit, push or deployment.
