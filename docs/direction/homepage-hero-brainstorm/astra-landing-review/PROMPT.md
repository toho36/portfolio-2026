You are a senior web art director, motion designer and front-end tech lead. Read-only review. Do not edit any file. Answer in Czech.

Owner wants: the portfolio homepage `/` rebuilt as a professional landing page with animations and dynamic reactions to the user. Later, separate Sol (GPT coding agent) workers will build each ticket in detail, possibly in parallel. Right now: brainstorm and critique only.

Read:
- docs/direction/homepage-hero-brainstorm/LANDING-BRAINSTORM.md (the proposal to critique)
- docs/direction/homepage-hero-brainstorm/BRAINSTORM.md and astra-review/REVIEW.md (earlier round; your own critique, option A "Rejstřík" recommended)
- docs/direction/homepage-hero-brainstorm/FRAMER-ANALYSIS.md and astra-landing-review/framer-skills-report.md (framer.com patterns)
- src/content/homePosters.ts, src/content/projects.ts, src/home/posterTimelines.ts, src/pages/Home.tsx (existing content and components)

Hard rules: audience HR / hiring managers / tech leads; read as experienced engineer, not vibecoder, but early adopter. Tone professional, restrained. No "AI" in headings. Only confirmed facts (SolidPixels: CMS, frontend, backend, third-party integrations; works solo and in teams). Mobile = desktop quality. Reduced-motion and no-WebGL fallback mandatory. Owner rule: homepage has one main motion per view; playful chaos belongs to /playground. One writer per Git common directory.

Task:
1. Does the page structure (6 sections) work for this audience? What to cut, merge or reorder? Is the page too long?
2. The tension: owner now asks for "animations and dynamic reactions" vs the one-main-motion rule. Is the proposed rule (one main motion per viewport + short reactive micro-states, nothing moves on its own) right? Give concrete examples of reactions that feel premium vs cheap for this page.
3. Proof panel: P1 / P2 / P3 — which, and what exactly must it show to be credible and not a fake demo? Name the biggest risk.
4. Name 3–5 specific signature moments (exact motion, trigger, duration, end state) that would make this feel award-level without breaking the rules. Be concrete, not adjectives.
5. Ticket breakdown T0–T7: correct dependencies? Missing tickets? Is the parallel plan (T3–T5 as separate sketch folders, serial integration in T6) sound? What must each ticket spec contain so a coding agent can execute it without guessing (acceptance criteria, files allowed, checks)?
6. Top 5 risks for the whole project.

Under ~1200 words. End with a JSON line: {"structure":"KEEP|REWORK","proof":"P1|P2|P3|other","tickets_ok":true|false,"add_tickets":[...],"signature_moments":[...]}.
