# Portfolio 2026 Interaction Storyboards

**Authority:** Hermes ticket `t_67a031b8`; unsupported implementation or content details are **TBD**. These sequences define behavior for prototype ticket `t_86ba9207`, not an implementation.

## Shared interaction contract

- Within the first 3 seconds, show the name **The Vitek Machine**, identify it as a portfolio, expose the cartridge mechanism, and make the primary next action understandable.
- The only project destinations are GameOnVB, Suburbs, Screen Switch, and VoleyEvents. Every mode preserves access to all four and the same public-safe content boundary.
- Forward scroll advances the mechanism; reverse scroll visibly reverses it rather than jumping or replaying forward animation. Input and response remain coupled.
- Drag moves a module. Click or press seats an available cartridge; the same action on a seated cartridge ejects it. State, focus, and control label must make the two outcomes unambiguous.
- A skip control bypasses the mechanism and reaches the cartridge list. A deep link opens the requested cartridge context directly, with project identity and a route back to the full list; it must not require replaying the entrance.
- Exact timing, easing, dimensions, camera, sound, haptics, gesture thresholds, and focus styling are **TBD** pending prototype and accessibility evidence.

## Desktop storyboard

1. **Comprehend:** In the first 3 seconds, the machine name, portfolio purpose, four-cartridge context, and scroll/skip affordances are visible without interaction.
2. **Drive:** Wheel or trackpad scroll moves the current scene forward in proportion to input. Reversing input reverses the mechanism and scene progress.
3. **Handle:** Pointer drag repositions an eligible module; visible constraints communicate where it can go. Click/press seats or ejects the focused cartridge and ends with a crisp mechanical payoff.
4. **Inspect:** The seated cartridge reveals only its public-safe preview and sourced description. Project switching remains available without returning through the opening.
5. **Return:** Reverse scroll returns through prior scene states; skip and direct cartridge links remain stable escape routes.

## Mobile storyboard

1. **Comprehend:** In the first 3 seconds, machine name, portfolio purpose, current cartridge, progress, and a plainly labeled browse/skip action fit the initial view.
2. **Drive:** Vertical touch scroll advances; reverse scroll reverses. Page scrolling remains understandable and must not be trapped by the scene.
3. **Handle:** One-finger drag moves an eligible module. A tap/press on the explicit seat/eject control performs the mechanical action; dragging must not accidentally trigger it.
4. **Inspect:** Cartridge content is readable without precision gestures. All four cartridges are reachable from a persistent or immediately available list.
5. **Link:** A deep link lands on readable project content with machine context and a route to all projects, not behind an entrance gesture.

## Keyboard contract

- Tab reaches skip, cartridge choices, draggable modules, seat/eject controls, project content, and navigation in logical order.
- Enter or Space activates the focused click/press action.
- Arrow keys move an eligible focused module through the same meaningful positions as drag; exact step model is **TBD**.
- Forward and reverse scene controls are keyboard operable and labeled; they produce the same ordered state transitions as scroll without requiring continuous animation.
- Focus is never moved or trapped merely because a scene changes. On deep link, focus begins at the project heading or equivalent project context; exact focus treatment is **TBD** pending accessibility validation.

## Reduced motion storyboard

1. **Comprehend:** Preserve the first-3-second identity, purpose, cartridge choices, progress, and skip control.
2. **Navigate:** Replace continuous kinetic travel with immediate or short discrete state changes. Forward/reverse controls still move through the same ordered states in both directions.
3. **Operate:** Drag may use discrete positions; click, press, touch, and keyboard seat/eject actions change state without sweeping camera or parallax motion.
4. **Reward:** Communicate payoff through state, contrast, and restrained transition rather than large movement. Do not remove content, controls, secrets, or rewards.

## Static fallback (no WebGL)

This is a content-access fallback, not a primary-renderer ruling.

1. Show machine identity, portfolio purpose, and a direct list of exactly four cartridges immediately.
2. Each cartridge opens its public-safe preview and sourced description using semantic static layout and ordinary links/controls.
3. Seat/eject state may become expand/collapse or selected/unselected state; drag is replaced by explicit move/select controls. Scroll remains normal document navigation, with back/forward access that does not depend on animation.
4. Skip targets the cartridge list. Deep links target the requested project heading/content and retain a route to all projects.
5. Touch and keyboard receive the same content and state outcomes; no project or required information depends on WebGL, motion, hover, drag, or pointer precision.

## Reward cadence

- **Micro reward:** each valid hover/focus, drag placement, and seat/eject action gets immediate state confirmation; acid yellow is allowed only when that confirmation is a secret/reward.
- **Scene reward:** completing a meaningful mechanism step resolves the scene and reveals the next cartridge choice or public-safe content. Reverse navigation restores the prior resolved state coherently.
- **Final reward:** after all four cartridge experiences have been reached, acknowledge completion and offer replay plus direct project access. Completion state must not invent performance metrics or block earlier content.

Cadence is event-based, not time-based. Exact reward copy, secret behavior, audio, visuals, and persistence are **TBD**.