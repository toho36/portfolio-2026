# Playground "Hot Wire VITEK" — design

Status: owner-approved direction 2026-09-25. Replaces the System Field playground. Supersedes `2026-09-25-playground-pile-design.md` (box pile is parked in `git stash` "playground box pile WIP" on branch `feat/playground-pile`, not deleted).

## Intent

- `/playground` = one skill game: buzz wire ("horký drát"). Hold a wand with a loop at its tip, move the loop along a wire without touching it. Touch = beep, back to start.
- Wire writes **VITEK**.
- Great with mouse and with touch. Local highscore.
- Two difficulties: **Easy** (loop rotates by itself) and **Hard** (player rotates the loop).

## Look

- 3D render (three.js), camera mostly frontal with slight perspective tilt so wire and loop read as objects.
- Background `--paper #f2efe6`. Wire: ink `--ink #090909` metal tube, soft shadow on the paper. Loop + wand: lime `--signal #d9ff43` loop, ink wand with lime grip.
- Start post and finish post clearly marked (small labels `START`, `FINISH`).
- Minimal HUD (DOM, not canvas): mode switch `Easy | Hard`, live progress `42 %`, `best 67 %` / best time, sound toggle. Short hint line.

## Wire path

- One continuous, non-self-intersecting curve, rounded corners (no zero-radius joints), in the XY plane.
- Letters readable as V I T E K. Letters connected by bridges near the baseline; visible gap between letters.
- Strokes that cannot be part of one continuous curve (e.g. E middle bar, parts of K, top of T) are **static hazard rods**: same material, not traversable, touching them also fails.
- Minimum distance between any two non-adjacent parts of the path and between path and hazard rods: ≥ 3 × loop outer radius (no shortcuts, no accidental touch of neighbour strokes).
- Path defined as data (points + corner radius) in one module; arc-length parametrised for progress.

## Wand and loop

- Pointer/finger holds the grip. Loop centre = grip + fixed screen offset: mouse `(0, -70 px)`, touch `(0, -110 px)` so the finger never covers the loop.
- Wand drawn grip → loop, with slight visual sway (spring, cosmetic only; loop position is exact).
- Loop is an **oval** torus: long axis must follow the wire direction.
- Easy: loop angle θ eases toward wire tangent at nearest point (time constant ~80 ms).
- Hard: θ changes only by player input.
  - Desktop: mouse wheel (≈ 6° per notch) and keys `Q`/`E` (hold, 180°/s).
  - Mobile: second finger anywhere; θ changes by the change in angle of the vector finger1→finger2 (twist). Lifting the second finger keeps θ.

## Collision rule (unit-tested, pure)

- `d` = signed lateral distance from loop centre to nearest wire point (within the current progress window), `α` = angle between loop long axis and wire tangent (wrapped to [-90°, 90°]).
- Fail when `|d| > innerRadius − wireRadius − innerRadius · |sin α| · MISALIGN_K`, `MISALIGN_K = 1.0` (tunable constant).
- Fail when the loop gets closer than `innerRadius + wireRadius` to any hazard rod or non-local path segment.
- Movement between frames is sub-sampled (step ≤ wireRadius) so fast moves can't tunnel.
- Progress continuity: nearest-point search only within ±(3 × loop outer radius) arc length of current progress. Jumping to another part of the path = fail.

## Flow

1. Idle: wand hangs at START. Hint: `grab the handle` (touch) / `click the handle` (mouse).
2. Press on grip (hit radius 40 px) → holding. Timer starts on first movement.
3. Release pointer / pointer leaves canvas → paused, wand stays. Resume only by pressing within 40 px of the grip.
4. Fail → beep (Web Audio, square ~220 Hz, 180 ms, buzzy), red flash on paper, small camera shake, 600 ms freeze, wand back to START, progress 0.
5. Reach FINISH → chime, time shown, `best` updated. `Play again`.
- Mode switch resets the run. Default mode Easy.

## Score

- Progress % = max arc length reached / total path length (current run).
- Per mode in `localStorage`: `vitek-wire:easy`, `vitek-wire:hard` → `{ bestPercent: number, bestTimeMs: number | null }`. Invalid/missing JSON → defaults, never throws.
- No online leaderboard.

## Camera

- If whole word fits with loop outer diameter ≥ 44 CSS px: static framing of whole word.
- Otherwise (phones): follow loop horizontally with smooth lag, zoom so loop outer diameter ≈ 56 CSS px; small overview minimap bar showing progress along the word (DOM).
- Portrait and landscape both supported.

## Sound

- Beep, 10 % progress tick (quiet), finish chime. Synthesized, no files.
- AudioContext created on first grab (user gesture). Sound on by default; toggle mutes and persists in `localStorage` `vitek-wire:sound`.

## Performance / platform

- Only `three` (already installed), dynamically imported on `/playground`; one import seam module. No Rapier, no physics engine.
- Loader `0–100 %` while three loads and scene builds.
- Pixel ratio `min(devicePixelRatio, 2)`; drop to 1 and disable shadow map if first 30 frames average > 22 ms.
- `touch-action: none` on canvas only; header nav works. Pause loop on hidden tab; dispose everything on unmount.
- `prefers-reduced-motion`: no shake, no sway, camera follows without easing overshoot.
- WebGL missing → fallback text `The playground needs WebGL.` + link home.

## Testing

- Pure modules unit-tested: path build + arc length + nearest point with window, collision rule (aligned pass, lateral touch, misaligned touch, hazard touch, tunneling via sub-sampling), hard-mode twist angle delta, score storage (corrupt JSON), progress continuity (jump = fail).
- Page SSR test: HUD, mode switch, fallback hidden, old System Field copy gone.
- `npm test`, `npm run check`, `npm run build`, `git diff --check` green.
- cmux proof (port 4183, `--host 127.0.0.1`; cmux can't load 4190): screenshots of idle, holding mid-path, fail flash, finish, both modes; narrow viewport; FPS; zero console errors.

## Out of scope

- Box pile (stashed). Homepage redesign. Online scores.

## Amendment 2026-09-25 (owner review of first build) — overrides sections above where they conflict

- **Loop orientation:** the loop is a round torus whose plane is perpendicular to the wire tangent (torus axis = tangent). Seen from the slightly tilted front camera it reads as a narrow ellipse crossing the wire; the front half renders in front of the wire, the back half behind it, so the wire visibly passes *through* the loop. No face-on oval.
- **Rotation is always automatic** (both modes): loop axis eases to the nearest wire tangent. Manual rotation (wheel, Q/E, two-finger twist) is removed. `MISALIGN_K` stays in the collision rule for the auto-rotation lag on sharp corners.
- **Hard mode** = smaller loop inner radius (≈ 70 % of Easy), no pause (releasing the grip = fail), faster rotation lag penalty at corners (tau ≈ 140 ms instead of 80 ms). Separate highscores stay.
- **Wire path follows the owner sketch** `/private/tmp/pile-run.9X4c/proof/owner-vitek-sketch.png`: ligature VITEK — V's right arm continues down as I; dot above I is a hazard; from I bottom the line runs right and up as the T stem; small curl at top, then the T bar runs right and doubles as E's top; E continues down through its middle bar to the bottom bar; then up into the K stem, K arms from the stem middle up-right and down-right. FINISH at the end of the K lower arm. START at the top of V's left arm. No stray floating dashes other than deliberate hazards.
