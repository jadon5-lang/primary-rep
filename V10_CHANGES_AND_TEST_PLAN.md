# THE SEAM V10.2 — Survey Revision and Test Plan

## Approved direction from thesis discussion
- Retain the nine research constructs and four-week recall period, now framed with distinct response modalities that correspond to each measured construct.
- Replace the four-choice 1–4 answer interface with a 0–100 interactive slider.
- Support precise one-decimal responses (0.0–100.0, increments of 0.1), plus optional numeric entry.
- Treat zero as the spatial origin. Its meaning depends on the item: for example, no influence, no dependency, never, no relief, no difficulty, or not willing.
- Preserve the same three drivers (family, finances, academic evaluation), the pressure pyramid and unique three-digit participant codes.
- Keep the existing researcher interface, protected endpoints, timestamps, individual records, CSV and Excel exports.
- The V10.2 questionnaire remains a pilot pending institutional approval and final contact/consent text.

## V10 measurement implementation
- Q1 and Q3: influence, 0 No influence / 100 Decisive influence. Q2: dependency, 0 Not dependent / 100 Completely dependent. Q4–Q6: frequency, 0 Never / 100 Very often. Q7: immediate relief, 0 No relief / 100 Substantial relief. Q8: delayed difficulty, 0 No difficulty / 100 Severe difficulty. Q9: willingness, 0 Not willing / 100 Fully willing.
- A participant must intentionally select a response, or explicitly skip each question; no automatic midpoint is submitted.
- Values are validated in the browser and server as finite 0–100 numbers on the 0.1 grid; skipped responses are represented as null, never zero.
- Normalization uses score/100 on each of three horizontal axes.
- The spatial height uses (Q1 + Q2 + Q3)/300 × 205, but only when all three axis questions are answered.
- 0,0,0 therefore plots at the central base; 100,100,100 at the central apex.
- Q4–Q6 remain the average of any answered concealment items; Q7 and Q8 remain separate outcomes, and Q9 is separately reported. Correlations use complete Q1–Q6 cases.
- The research summary bins answered responses into 0–24.9, 25–49.9, 50–74.9, and 75–100; raw values remain unbinned, with answered and skipped counts.
- Workbook formulas and CSV values preserve V10 decimal responses; skipped cells remain blank, and invalid spatial coordinates are never inferred.

## Storage/version isolation
- The original live Netlify site must remain attached to **v9-staging** until tested V10 is explicitly approved for production.
- The V10.2 server uses a new site-wide Blob store **the-seam-verified-responses-v10-2** only when running in an explicitly verified production context.
- Nonproduction deployments use the deploy-specific store **the-seam-verified-responses-v10-2-preview**.
- Each V10.2 record carries survey_version: 'V10.2'; V9, V10 and V10.1 records cannot be interpreted as V10.2 responses.
- Local storage and anonymous device-token keys are suffixed v10_2, separating this revision from prior pilot questionnaires.
- Do not mix prior questionnaire responses with V10.2, even when the old and new numeric ranges both span 0–100; they measure different things.

## Required checks before original-domain deployment
1. Run automated backend tests on GitHub Actions for v10-staging.
2. Create or connect a **separate Netlify test site** to v10-staging; do not alter the original site's production branch yet.
3. Confirm the consent statement appears before the survey and every question can be answered or explicitly skipped without a forced zero.
4. Submit a 0.0, a 0.1, a 50.5, a 99.9 and a 100.0 on different test cases.
5. Check 3D base (0,0,0) and apex (100,100,100) coordinates and horizontal pressure leaning.
6. Confirm study count, timestamps, unique IDs, protected researcher access, and 3-second dashboard refresh. Confirm the diagram is never displayed to students until submission.
7. Download Excel and CSV; verify original decimal values, blank skipped cells, answered/skipped counts, and plotting formulas.
8. Confirm that V9 production responses, URL and QR continue unchanged.
9. Verify participant and researcher withdrawal flows, then complete the researcher contact fields and institutional ethics/IRB and consent requirements before recruiting participants.

## Deployment policy
Staging and tests may contain pilot data. Never publish V10 at the original Netlify URL without the user's approval after preview testing.
