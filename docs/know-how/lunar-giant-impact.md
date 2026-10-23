# Lunar giant impact — know-how

Moon-forming collision animation for the portfolio, sketches 015–024 (2026-10). Parked as a side project on 2026-10-09: not the homepage hero. Source paths are relative to the repo root. The Lunar `sketches/` and `docs/direction/lunar-*` folders were never in Git and were moved to the macOS Trash on 2026-10-23; the paths below name where each lesson came from. The reusable code is kept in Git in [`lunar-giant-impact/`](lunar-giant-impact/).

## What was tried

| Sketch | Approach | Result |
|---|---|---|
| 015 | Two AI-generated keyframes | Direction only: owner chose "A1 Dramatic", blue present-day Earth as end state |
| 016 | three.js static poses | Rejected: repeated cracked-soil texture, flat orange neck ribbon, glossy ocean |
| 017 | One MarchingCubes volume + PBR rock | Better form, but glowing cell outlines read as tiles |
| 018 | Voronoi glow grid removed | Rejected: bright patches on smooth rock, pinched Moon joint |
| 019 | Recessed fracture mesh + baked heat atlas | Rejected: crack too continuous and white, Moon too smooth |
| 020 | Tilted crust shelves, side walls, triplanar rock, Moon-only fill light | **Best static result (PASS)** |
| 021 | Authored mesh stretch / thin / split | Critic PASS, owner rejected: "robotic and unreal" |
| 022 | Realtime particles, self-gravity, 96³ density surface | Rejected after 4 tries: "corrugated rubber appendage" |
| 023 | Theia impact, toy gravity + authored capture | Parked: Moon "reads like a football" |
| 024 | Blender: Voronoi clay, flow morph, real SPH (pkdgrav3) | Voronoi = broken glass; morph rejected; 1,104-particle SPH merged into one blob; 10M particles not feasible locally |

## Lessons

### Look
- Even, bright cell edges (Voronoi plates) make a sphere read as a football or broken glass. Do not put plate or tile patterns on spheres. (`sketches/023-lunar-impact/STATE.json`, `sketches/017-lunar-material-repair/RESULT.md`)
- Build the look from large dark masses and recessed heat (dark walls, glowing floor), not from glowing lines on the surface. (`sketches/023-lunar-impact/polish-review/HANDOFF.md`)
- Do not show the finished crater texture on an unfinished shape. Do not drive the whole body with one global time curve; it looks forced. (`sketches/023-lunar-impact/moon-rethink/NEW-SESSION.md`)
- A dark Moon on black needs its own fill light, not a glow or a rim. (`docs/direction/lunar-a1-moon-visibility-brainstorm.md`)

### WebGL / three.js
- Extract Moon, neck and planet as one closed mesh. Separate pieces show seams and collars. (`sketches/019-lunar-crust-relief/RESULT.md`)
- Bake heat into a small R8 3D atlas and sample it per pixel, not per vertex. (`sketches/019-lunar-crust-relief/RESULT.md`)
- Budgets that held: ≤150k triangles, ≤80 draw calls, ≤2 MP canvas, ≤4 MB textures, no rendering while idle; on WebGL context loss show a capture of the same pose. (`sketches/018-lunar-heat-repair/RESULT.md`)
- Squash without changing volume. Hide debris only when it is fully inside Earth. UI timing rules (350 ms, overshoot) do not fit planetary motion. (`docs/direction/lunar-pro-motion-review/HANDOFF.md`)

### Physics
- No public time series of a Moon-forming SPH run was found. Kegerreis 2022 shares data "on reasonable request". Meier 2024 (Dryad, CC0) is 35.8 GB packed, 238 GB unpacked, and documents initial and outcome states, not a contact sequence. (`sketches/024-lunar-blender/public-state-audit-20261007/REPORT.md`)
- pkdgrav3 on macOS needs two local fixes (`sys/mman.h`, clear callbacks before `Py_Finalize`) and HDF5. (`sketches/024-lunar-blender/pkdgrav3-preflight-20261006T193239Z/pkdgrav3-local-fixes.patch`)
- ANEOS "energy below cold curve" abort: fixed with `bGasIsentropic=True` and the correct grid-cell mass. (`sketches/024-lunar-blender/pkdgrav3-energy-20261006T221901Z/REPORT.md`)
- SWIFT on Apple Silicon: `--disable-vec`, no `-ffast-math`, clean `HDF5_LIBS`. At 10M particles it still aborted at start (density/energy mismatch at material interfaces). (`sketches/024-lunar-blender/swift-admission-20261007T181400Z/`)
- On a 4-thread Mac CPU, 10 simulated seconds at 10M particles took 577 s of wall time. A full 35 h impact is not feasible locally. (`sketches/024-lunar-blender/autonomous-moon-20261007T092602Z/profile-repair-20261007T111011Z/generator-verified-v2/FINAL-REPORT.md`)

### Blender
- Pre-fractured Voronoi looks like broken glass; green geometry tests checked the wrong idea. (`sketches/024-lunar-blender/flow-repair-20261006/PHYSICS.md`)
- Headless previews: `blender --background --factory-startup --disable-autoexec --python-exit-code 1`, 640×360, 4 samples, 2 threads, about 32–40 s per clip. (`sketches/024-lunar-blender/README.md`)
- Particles to mesh: NPZ loaded with `allow_pickle=False`, then Points to Volume, then Volume to Mesh. (`sketches/024-lunar-blender/sph-replay-20261007T073122Z/`)

### Process
- A critic PASS and green tests are not owner acceptance. It happened twice (021, 023). Show the owner early.
- Cap tuning at about 3 attempts per idea, then change the approach.
- Long high-effort model calls timed out; short medium-effort calls worked. (`sketches/023-lunar-impact/impact-rethink/repair-20261006/HANDOFF.md`)
- Most of the ~9 GB on disk is evidence and simulation data, mainly 024 (5.0 GB) and 023 (3.9 GB).

## Worth reusing
All in [`lunar-giant-impact/`](lunar-giant-impact/) (code only, no textures or simulation data):
- `020-static/`: best static scene: `crust.js`, `volume.js`, `geology.js`, `cold-geology.js`, `scene.js`, `bake-heat.mjs`, texture licences in `assets-manifest.json`, browser check `verify-chrome.py`.
- `023-runtime/`: last realtime runtime (`main.js`, `motion.js`, `terrain.js`) with `capture.py` and `verify-runtime.py`. The same runtime was in `src/playground/giantImpact/` until commit `ce89567`; restore it from Git history with `git show ce89567:src/playground/GiantImpact.tsx`.
- `024-blender/`: `build_scene.py`, `flow_scene.py`, `test_flow.py`, `sph-replay.py` (particles to Blender volume), `pkdgrav3-local-fixes.patch` (macOS build fixes).
Scripts still contain the original absolute paths (Blender app, scratch build folder); change them before use.
