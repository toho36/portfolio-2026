# VoleyEvents rally browser acceptance

Status: PASS

Candidate ID: working-tree:80bf99bba621e3f9c3f203c71306d18f8dbe988327d53dd605e839ab15a0abd8:0fa78dfc18f9ad4546e2ccf5ee131cd401a718223868e00d47432f270ccd94b8

- [x] Desktop and physical-phone screenshots: hero plus four impact stops
- [x] Direct load, trailing slash, fragments, and Back/Forward
- [x] Keyboard focus and native scrolling
- [x] Reduced motion: zero GSAP/Three requests and zero canvas
- [x] No-WebGL and context-loss static fallback
- [x] Forward/reverse/alternating progress determinism
- [x] Pointer/touch disturbance without captured vertical scroll
- [x] Resize/orientation and long-copy fit
- [x] 10x route lifecycle: zero retained canvas, trigger, RAF, listener, or context
- [x] Sibling-route request isolation
- [x] Overflow zero; no console errors, failed requests, or hidden essential content
- [x] No rendered HUD or public diagnostics/metrics

Physical target: Samsung SM-G950F, Android 9, serial redacted. Five same-run screenshots are stored locally at `/tmp/voleyevents-physical-stop-0.png` through `-4.png`; observed states were `serve`, `event-opens`, `player-registers`, `payment-matches`, and `attendance-resolves`.

Desktop performance and High-tier diagnostics were captured from the local production preview. Physical performance used ADB reverse plus the phone's real Chrome/GPU; emulation was used only for layout widths. The physical Low renderer missed its target twice and correctly surrendered to the static fallback for the visit.
