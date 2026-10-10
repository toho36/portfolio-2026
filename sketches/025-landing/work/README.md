# T4 isolated preview

Mounts only `WorkIndex`, with T1 page styles and T2 tokens. No route changes.

From the repository root, serve this harness through Vite and open
`/sketches/025-landing/work/`. The parent owns browser/visual checks.

Integration: import `WorkIndex` and `WORK_ITEMS` from
`src/home/landing/work/WorkIndex`; supply the page's shared `coordinator`.
Pass T5a's component as `screenSwitchDemo` (a React node, with that same
coordinator). This slot mounts below the selected Screen Switch row and is
outside the attachment mask. Only one copy is mounted.

All four contribution sentences remain visible. Arrow keys move row focus;
Enter or Space selects. Hover only highlights. The selected attachment is
sticky only at width > 1000 and height >= 760; otherwise it follows its row.
SolidPixels detail uses a native text disclosure, initially expanded.

The clip-path adapter uses Web Animations and the shared motion coordinator,
220 ms duration and shared easing. Replacement, competing motion, hidden
page, offscreen attachment, preference change and unmount settle immediately.
No animation runs on initial render, resize or return to visibility.

The owner has not supplied a publishable SolidPixels problem/change/check
example; COPY.md explicitly says to omit it until supplied. No invented proof.
