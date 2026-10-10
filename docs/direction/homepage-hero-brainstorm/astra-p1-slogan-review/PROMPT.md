You are a senior copywriter-minded art director and front-end tech lead. Read-only review. Do not edit any file. Answer in Czech (slogans themselves stay in English).

Context: read docs/direction/homepage-hero-brainstorm/LANDING-PLAN-v2.md and astra-landing-review/REVIEW.md (your previous critique). Owner answered the open questions:
1. SolidPixels CMS UI may NOT be shown at all. So proof panel P1 "CMS → web" is impossible.
2. Backend proof: GameOnVB (owner's own product, live at https://gameonvb.cz/) has the backend. See src/content/voleyevents.ts (VOLEYEVENTS_LIFECYCLE: event opens → player registers → QR-bank payment matches → attendance resolves) and src/content/projects.ts. GameOnVB source repo is local (VoleyEvents); a local dev instance can be filled with disposable QA demo data, so real UI screenshots with fake people are possible.
3. Slogan "New tools. Old standards." may be replaced. Brainstorm something else.

Task A — new proof panel. Proposed P1': "GameOnVB lifecycle": 4 steps from real local UI with demo data: (1) organizer opens a recurring event with capacity, (2) player registers on the public page, (3) QR bank transfer gets matched to the registration (admin/money state), (4) organizer resolves attendance. Each step shows the real screen crop plus one line on what the system does behind it (backend/integration). Label "Reconstruction with demo data". Triggered by a button, ~6 s, pausable.
- Is this credible proof of frontend + backend + integration for HR/tech leads? What exactly must each step show? What would make it fake or boring? Better alternative?
- SolidPixels now appears only as text in the work index (team experience). Is that enough? How to make team work credible without screenshots?

Task B — headline. Candidates:
 a) "New tools. Production standards."
 b) "I build web platforms and the systems behind them."
 c) "Software teams can keep running."
 d) "From the editor to the database."
 e) "Full-stack web development, alone or in a team."
 f) "Production web software, from interface to integration."
 g) "Websites, platforms and the parts in between."
 h) "I build what editors use and what visitors see."
Rules: senior, restrained, no puns, no "AI" in headings, only confirmed facts (works solo and in teams; SolidPixels: CMS, frontend, backend, third-party integrations; GameOnVB full-stack). Must pair with name + role "Software Developer" and one responsibility line.
- Rank top 3 (you may write up to 3 better ones of your own). For each top pick give the full hero text block: headline + one responsibility sentence (max 22 words).

Under ~900 words. End with JSON line: {"p1":"KEEP|REWORK|REPLACE","p1_steps":[...],"headline_top3":[...],"recommended_hero":{"headline":"...","line":"..."}}.
