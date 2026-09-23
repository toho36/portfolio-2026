# Goal Loop / delivery instrument study

Open http://localhost:3001/sketches/003-instrument/index.html

Stance: let visitors operate a bounded delivery model instead of reading a long process diagram.

- Typography: emphatic large headline, clearly labeled stages and a concise readout.
- Color/material: dark green-black, warm aluminium, vermilion candidate marker.
- Interaction: advance/rewind a model run, introduce a failing check, return to implementation, repair, retry, pass or stop at a bounded failure outcome; Reset restarts the illustration.
- Strong at: explaining a real design principle through action and a visible consequence.
- Weak at: the deliberately simplified model is not a real agent runtime. The fixed two-return limit belongs to this study, not all actual Goal Loop runs. Rewinding inspects/replays the model; it never operates a real pipeline.
- Deliberately rejected: fake terminal output, fake agent metrics, automatic green status on a failing check, real executions from a portfolio.

The source modules/case-study route remain the public fact authority. Run `python3 sketches/verify.py` with the local server and dedicated CDP Chrome running.
