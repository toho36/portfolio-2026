# T5 practice/contact preview

Mounts only `PracticeSection` and `ContactSection`, with the unchanged T1 page styles and T2 tokens. No route or `LandingPage` integration.

From the repository root:

```sh
node node_modules/vite/bin/vite.js sketches/025-landing/practice --config vite.config.ts --configLoader native
```

The worker does not start or leave a server running. The parent can use the harness for the prescribed viewport and motion checks. The form uses the real sender: use unit tests for mocked success/failure; do not send a test message from the browser.

For T6: import the two components from `src/home/landing/practice`. Pass `PracticeSection` the approved COPY.md introduction, six gate objects (`id`, `label`, `evidence`) and the **page's shared coordinator**. Empty evidence renders only the gate label; no invented run state. Dispose the page coordinator on page unmount. Keep the page wrapper's T1 stylesheet/token imports.

The only dominant motion is the decorative rail's `scaleX`, driven bidirectionally by shared `scrubReveal`. Gate labels and optional evidence remain in readable HTML at every scroll position. Reduced motion renders the complete rail with no transition and no runtime load. Contact status uses polite announcements and focused success; validation focuses the first error.

Preview build:

```sh
node node_modules/vite/bin/vite.js build sketches/025-landing/practice --config vite.config.ts --outDir /tmp/landing-t5-build --emptyOutDir --configLoader native
```
