# Light-table proof

Owner approved one isolated, working prototype before extending the actual routes.

Allowed: new `sketches/013-light-table/` only. Reuse public source components and installed packages read-only. Production pages, prior studies, manifests, dependencies and source contracts stay byte-identical. No commit or deploy.

Experience: explore, not solve. Three authored sheets (Goal Loop, GameOnVB, introduction), a dominant fan on a dark tactile table, masked four-word title, native vertical scroll that deals the sheets forward/back, direct hover/touch response, and real link/keyboard alternatives. Goal Loop enlarges the same wristwatch presentation into a native dialog; its renderer, camera framing, phase and reveal survive entry, return and interrupted history reversals. This is the approved first-stage prototype, not a migration of /goal-loop. Re-entry/back interrupts correctly and cleans up live rendering. No iframe, game objective, fake workflow run or required loader.

Rendering ownership: deck geometry and typography are DOM/CSS 3D surfaces, not volumetric WebGL. The watch has one renderer-owned presentation (canvas and same-model preview), moved between the card host and dialog slot without moving React-owned DOM. Offsheet, hidden, reduced-motion and unmount release the renderer; hidden time does not advance. A critically damped progress model preserves velocity on reversal and lands softly in both directions. Volleyball uses curved Three meshes, outward normals, matte 1024px pebbled leather and transparent rendering. Slow idle drift/spin keeps it alive; pointer passes through its projected circle add velocity-based angular momentum. Repeated same-direction passes accelerate it, leave never resets its orientation, and exponential damping brings it back to gentle idle spin. Pointer hit targets and CTA remain stationary.

Fallback parity: no unrelated SVG or generated ball photo remains. `/ball-preview.png` is a transparent native capture of this exact material/geometry for cold loading, reduced motion and no-GPU states. Offsheet teardown captures the last live pose, then releases resources; hidden time does not advance. The original generated JPEG is retired. Concept moodframes remain design references only.

Ball checks: `node --test sketches/013-light-table/ballGeometry.test.mjs` checks all 18 unit-sphere panels, normals and outward winding. `python3 sketches/013-light-table/ball-3d.py` checks actual triangles, transparent framebuffer corner pixels, native pointer pose changes, six-width bounds, idle/offscreen teardown, reduced motion and real context-loss fallback.

Verification: focused model checks RED/GREEN; build isolated app; native browser desktop and 390/320 mobile screenshots; native scroll/reverse/click/key/touch; interrupted project entry/back; no-WebGL and reduced motion; return/resume; console and overflow; immutable production hash comparison; independent review. Physical-phone performance and owner visual acceptance remain unproved until actually checked.

## GameOnVB ball entry (isolated approved stage)

`View project` now enters native `#gameonvb`; its header keeps the separate full case-study link to `http://127.0.0.1:5181/gameonvb`. The Goal Loop dialog stays first in the DOM and its flow remains unchanged.

The ball's imperative presentation moves outside card overflow, carrying the same renderer/canvas, 18 meshes, palette `#f2ecd9/#dfae16/#2d1755`, pebbled leather and textures. Its viewport backing preserves the first-frame projection within the existing DPR1.5/4MP budget. One RAF owns both spin and entry. The isolated 3.55s sampler runs pop (0–.30), card contact (.30–.62), accelerating leftward roll (.62–1.70), actual lower-left corner (1.70–1.85), ballistic fall (1.85–3.10), then one small upper-tread landing bounce and rest (3.10–3.55). Contact follows the measured DOM support and pop-scaled radius; quaternion travel follows distance/radius. The whole fan exits upward without opacity fade, and camera rotation begins after its 2.50s exit. Source lights match on the first frame and change gradually. Reversals brake the current flight clock before reversing; spin time always advances forward, with the full orientation and angular derivative bridged back to the source. The detail contains only the three existing stone blocks and trims copied narrowly from the read-only staircase renderer, with no second ball, drag UI or automatic roll down.

Return/Escape/history restore exact source scroll and CTA focus. Direct hashes use a centered source pose when the card is offsheet. Hidden/offsheet/unmount cancel frames, release resources and invalidate pending imports. Reduced/no-GPU/context-loss retains the exact ball PNG; static steps use CPU projection of the same block dimensions and camera, with simplified stone shading. Physical devices and visual acceptance remain unproved.

Production integration and step/environment redesign remain deferred. The red arrows in the references are trajectory guides only:
- [Source lower edge](references/clipboard-2026-10-02-114633-56FB4EA1.png).
- [Existing upper tread](references/clipboard-2026-10-02-114653-E00635B3.png).

Parent acceptance after rebuilding: `python3 sketches/013-light-table/ball-flow.py`, then retain the existing watch/card/scroll/ball probes. The writer did not run browser checks or rebuild either preview server. See [BALL-ENTRY-CHECKS.md](BALL-ENTRY-CHECKS.md) for RED/GREEN evidence and limits.

Step 5 updates the acceptance fixtures to the actual quaternion/trace contract and dynamic Three loader request. Writer checks pass in Node; the final parent native matrix and independent code review remain required. The isolated choreography has not established owner art approval or physical-phone acceptance.
