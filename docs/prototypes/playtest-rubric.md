# Vitek Machine prototype playtest rubric

Status: **OBSERVED — user ranking captured on 2026-08-03.**

Winner: **Assembly bench (final).** The later scroll-scrubbed media challenger proved seeking and fallback plumbing, but its visual was only a subtle zoom over a still image and was rejected as product direction.

Observed ranking: **1. Assembly bench · 2. Machine timeline · 3. Conveyor / rewind.**

Observed performance feedback: Conveyor / rewind felt extremely slow; Machine timeline also felt slow. Numerical 1–5 scores were not collected and remain unfilled rather than invented.

## Setup

1. Run `npm install` and `npm run dev`, then open the printed local URL in a browser.
2. Test Conveyor / rewind, Assembly bench, and Machine timeline in that order. Start each loop from its first state by selecting its loop button; do not explain the mechanic before the comprehension check.
3. Repeat the touch steps at a 390px viewport on a touch device or browser touch emulation.
4. Repeat the reduced-motion steps after enabling the operating system or browser `prefers-reduced-motion: reduce` setting and reloading.
5. Record observations only after all three loops have been operated. Do not select a winner during this prototype delivery.

## Exact observation steps

### Unprimed comprehension

1. Show the initial page for exactly 3 seconds without input.
2. Hide it and ask: “What is this, what can you operate, and what would you do next?”
3. Record whether the participant identifies a portfolio, the cartridge mechanism, and a next action without prompting.

### Conveyor / rewind

1. Select **Conveyor / rewind**.
2. Scroll forward through all four stops, then reverse to the first stop.
3. Use **Next cartridge** twice and **Previous cartridge** once.
4. Confirm controls land on the same stops as scrolling and record any jump, forward-only replay, lost label, or unclear state.

### Assembly bench

1. Select **Assembly bench**.
2. With a pointer, drag the module outside the slot and release; then drag it into the slot and release.
3. Activate the now-labeled **Eject module** control and confirm the module returns to the same home position.
4. At 390px with touch, begin a drag on the module, move outside its original bounds, release once outside the slot, then repeat into the slot. Verify ordinary page scrolling still works when the gesture begins outside the module.
5. Keyboard-only: Tab to the module, move it with every arrow direction, press Enter to seat, press Space to eject, then use the state-dependent action button to seat and eject once more.
6. Record accidental seating, cancellation failures, precision barriers, hidden state, or labels that do not match the next action.

### Reversible machine timeline

1. Select **Machine timeline**.
2. Scroll forward to stage 3, activate **Change later-stage signal**, continue to stage 4, reverse to stage 1, then move forward to stage 3 again.
3. Confirm the changed signal remains visible at every stage and after repeated threshold crossings.
4. Restore and change the signal once more, then use previous/next controls through every stage. Confirm those controls land on the same stops as scrolling.

### Reduced motion

1. Enable reduced motion and reload.
2. Repeat each loop’s steps above.
3. Confirm scroll progress resolves to immediate ordered stops; no large transform interpolation or overshoot occurs.
4. Confirm drag, arrow movement, seat/eject, signal mutation, previous/next, all text states, and reward contrast remain present and operable.

## Scorecard

Score each loop from 1 (fails) to 5 (clear/strong). Leave every cell PENDING until observed human playtesting.

| Criterion | Conveyor / rewind | Assembly bench | Machine timeline | Observation |
| --- | --- | --- | --- | --- |
| Comprehension within 3 seconds | PENDING | PENDING | PENDING | PENDING |
| Desire to interact again | PENDING | PENDING | PENDING | PENDING |
| Distinctiveness | PENDING | PENDING | PENDING | PENDING |
| Forward/reverse coherence | PENDING | PENDING | PENDING | PENDING |
| Pointer/touch/keyboard usability | PENDING | PENDING | PENDING | PENDING |
| Reduced-motion behavior | PENDING | PENDING | PENDING | PENDING |
| Perceived smoothness | PENDING | PENDING | PENDING | PENDING |

Results: **Assembly bench won the first comparison. Conveyor / rewind is rejected in its current slow form; Machine timeline remains secondary but also needs direct, faster scroll response.**

Winner: **Assembly bench.** Build the production mechanic as a real-time R3F/Three.js machine; use GSAP + ScrollTrigger for reversible choreography. Do not carry the rejected video-proxy UI, assets, or validator into production.
