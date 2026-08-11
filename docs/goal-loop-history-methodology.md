# Goal Loop history graph methodology

## Public claim

The graph may say only that one verified fast-feedback change set reduced three measured costs on this M1 Max checkout:

| Measurement | Before | After | Reduction |
|---|---:|---:|---:|
| Full verification wait | 2,365–2,432 s | 290.7 s | at least 87.7% |
| Representative pipeline fixture | 11.35 s | 8.52 s | 24.9% |
| Representative Git helper launches | 209 | 119 | 43.1% |

Formula: `(before - after) / before × 100`. The full-suite percentage uses the lower end of the recorded before range, so the displayed claim is conservative.

## Source and closure

Authoritative source: the Goal Loop repository audit `docs/audit/2026-08-09-fast-feedback-smart-audit.md`, especially its “Before and after”, “Goal Loop runtime”, and “Verification” sections.

The source records:

- before suite: 395 tests in approximately 2,365–2,432 seconds;
- after suite: 403/403 passing in 290.7 seconds with 12 workers;
- representative pipeline fixture: 11.35 seconds before and 8.52 seconds after;
- representative Git helper launches: 209 before and 119 after;
- no tests deleted, skipped, weakened, or replaced;
- final security regressions for files/reftable and linked worktrees passed.

The public dataset is manually allowlisted in `src/content/goalLoopHistory.generated.ts`. It contains no raw run paths, prompts, goals, task IDs, provider/model identifiers, credentials, or internal artifacts.

## Important limitations

This is descriptive evidence from one machine and one direct-parent fast-feedback change set. It is not a model benchmark, a provider comparison, a claim about all software tasks, or proof that every production Goal Loop run is 87.7% faster.

The full-suite comparison is deliberately labelled “verification wait”, not a matched-workload experiment: the stronger after revision ran eight additional tests. That makes proof coverage stronger but prevents treating the number as a pure scheduler-only causal estimate.

The representative fixture and Git-call measurements explain the mechanism, but each is a single recorded before/after profile from the audited optimization campaign. They must display their absolute values beside the percentage.

## Rejected matched campaign

A later private campaign attempted five methods × six adjacent control/candidate repetitions. It was not used for public claims:

1. an outer network-deny sandbox invalidated the first attempt by preventing nested Goal Loop Seatbelt profiles;
2. after that was corrected, two fixtures completed consistently, but a notification timeout fixture failed during warmup;
3. the predeclared campaign required all runs to pass, so the campaign stopped and its partial results were excluded.

This failure is evidence against manufacturing a prettier aggregate from incomplete data. The public graph therefore uses the already reviewed audit measurements above and says exactly what each measurement represents.

## Visual contract

- Show absolute before and after values, reduction percentage, unit, and proof note together.
- Prefix every value with literal visible `Before` or `After`; color and position are never the only distinction.
- Use three separate comparison rows; do not merge seconds and process counts onto one quantitative axis.
- Normalize each row independently: the conservative `before` value is 100% track width and `after` occupies `after / before × 100%`. For the full-suite range, draw 2,365 seconds as the quantitative baseline and show 2,365–2,432 seconds in text; this matches the conservative percentage claim.
- Keep values visible in static HTML. Inline SVG may echo the comparison but must not own essential text.
- Animate only a short reversible transform of the marker already fixed at the `after / before` boundary. Do not count numbers upward, animate the track geometry, or draw the data into existence.
- Reduced motion and unsupported scroll timelines show the complete final state.
- On mobile, values use normal document flow above the track; they must not remain opposing absolute labels.
- Render the methodology source label as plain text. The repository path is provenance, not a public hyperlink.
- No hover-only values, focus movement, scroll hijacking, chart dependency, or private artifact link.
