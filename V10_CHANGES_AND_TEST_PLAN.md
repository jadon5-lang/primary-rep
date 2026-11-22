# THE SEAM V10 — Survey Revision and Test Plan

## Approved direction from thesis discussion
- Retain all nine existing survey questions and the four-week recall period.
- Replace the four-choice 1–4 answer interface with a 0–100 interactive slider.
- Support precise one-decimal responses (0.0–100.0, increments of 0.1), plus optional numeric entry.
- Treat 0 as the spatial origin and valid "Never" survey response.
- Preserve the same three drivers (family, finances, academic evaluation), the pressure pyramid and unique three-digit participant codes.
- Keep the existing researcher interface, protected endpoints, timestamps, individual records, CSV and Excel exports.
- This V10 questionnaire remains a pilot pending institutional approval and any appropriate consent revisions.

## V10 measurement implementation
- Questions still ask "How often..." and use 0/Never and 100/Often endpoints.
- A participant must actively choose a response for every question; no automatic 50 score is submitted.
- Values are validated in the browser and again on the server as finite 0–100 numbers on the 0.1 grid.
- Normalization uses score/100 on each of three horizontal axes.
- The spatial height uses (Q1 + Q2 + Q3)/300 × 205.
- 0,0,0 therefore plots at the central base; 100,100,100 at the central apex.
- Q4–Q6 remain the averaged concealment-behavior measure; Q7 and Q8 are separate outcomes; Q9 is separately reported.
- The research summary bins responses into 0–24.9, 25–49.9, 50–74.9, and 75–100; raw values are preserved unbinned.
- Workbook formulas and stored CSV values preserve V10 decimal responses.

## Storage/version isolation
- The original live Netlify site must remain attached to **v9-staging** until tested V10 is explicitly approved for production.
- The V10 server uses a new site-wide Blob store **the-seam-verified-responses-v10** only when running in an explicitly verified production context.
- Nonproduction deployments use the deploy-specific store **the-seam-verified-responses-v10-preview**.
- Each V10 record carries survey_version: 'V10'; V9 records cannot be read as V10 responses.
- Local storage and anonymous device-token keys have distinct V10 names, so prior V9 browser submissions are not mistaken for V10 submissions.
- Do not manually move raw V9 1–4 responses into V10's 0–100 store.

## Required checks before original-domain deployment
1. Run automated backend tests on GitHub Actions for v10-staging.
2. Create or connect a **separate Netlify test site** to v10-staging; do not alter the original site's production branch yet.
3. Confirm the survey begins with an unselected slider and cannot advance without a chosen answer.
4. Submit a 0.0, a 0.1, a 50.5, a 99.9 and a 100.0 on different test cases.
5. Check 3D base (0,0,0) and apex (100,100,100) coordinates and horizontal pressure leaning.
6. Confirm study count, timestamps, unique IDs, protected researcher access, and 3-second dashboard refresh.
7. Download Excel and CSV; verify original decimal values and formulas match the plotted results.
8. Confirm that V9 production responses, URL and QR continue unchanged.
9. Review any necessary university ethics/IRB and consent changes before real data collection.

## Deployment policy
Staging and tests may contain pilot data. Never publish V10 at the original Netlify URL without the user's approval after preview testing.
