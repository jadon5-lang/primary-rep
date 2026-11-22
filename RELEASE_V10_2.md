# THE SEAM V10.2 — Release / Rollback Checklist

## Release intent
Replace **only the participant-facing survey experience** on the existing Netlify site. Preserve the current researcher's interface: layout, password login, ?report=1 route, 3D researcher chart, individual record inspection, statistics, CSV export, Excel export and refresh. Update statistical labels/formulas only as needed for truthful interpretation of V10.2 scores.

## Verified technical connections
- The public participant form and private researcher view are served by the same public/index.html and Netlify functions.
- V10.2 POST /api/submit writes versioned participant responses into the V10.2 Netlify Blob store.
- Password-protected GET /api/research loads those new records into the same researcher dashboard UI.
- GET /api/export and GET /api/workbook read the same store and include 0–100 decimal scores.
- GET /api/map reads the same store for the post-submission participant diagram, requiring verified submission and at least five plotted records for other participants to be visible.
- The private dashboard keeps the existing ?report=1 URL and password gate (SEAM_RESEARCHER_PASSWORD).
- The user-facing diagram remains hidden until successful submission. The sliders have a gold-left/ghost-right track, 50 ghosted default preview, enlarged handle, and bold green questions.
- The seven-column research distribution table has the same structure as V9. Header labels are updated to 0–24.9 / 25–49.9 / 50–74.9 / 75–100; skipped responses are excluded rather than treated as zero. All answered/skipped counts remain in the underlying summary and workbook.
- The research interface does not display any new removal button; server-side withdrawal handling remains available to honor participant requests.
- Automated tests cover the UI structure, API authorization, participant → researcher → CSV/Excel linkage, data-version isolation, plotting, valid decimals, skipped questions and withdrawal.

## The data transition (do not skip)
- V9 used the site-wide production Blob store `the-seam-verified-responses-v8`, with original 1–4 frequency-coded answers.
- V10.2 will use a **different** site-wide production Blob store `the-seam-verified-responses-v10-2`. Existing V9 data is not erased or overwritten.
- **The familiar research interface will show NEW V10.2 responses only after cutover**. It must not silently merge older V9 numerical responses with the new mixed influence/dependency/frequency/impact/willingness ratings.
- Before switching production, log into the existing V9 researcher report and export BOTH CSV and Excel copies for an accessible historical archive. Record the current Netlify deploy ID and live production branch to support a rollback.
- If historical V9 records need long-term access from within the new researcher dashboard, design a separate, clearly labeled archive feature before rollout. This release deliberately avoids changes to the researcher's visual layout.

## Required before the website is published for formal research
1. Confirm approved consent language and institutional/IRB requirements with the advisor.
2. Replace `[researcher name to confirm]`, `[researcher email]` and `[faculty supervisor email]` in the public consent notice with authorized contact information. Do not invent or auto-publish addresses.
3. Review the questionnaire wording and the meaning of Q1–Q9 one last time; the V10.2 data schema must not change after official responses are gathered without another version.
4. Verify `SEAM_RESEARCHER_PASSWORD` remains configured in Netlify's production environment. Never commit passwords to GitHub.
5. Use a separate Netlify test deployment from the release branch to submit at least two deliberately varied sample responses. Confirm researcher login, unique ID, private records, chart points, CSV/Excel values, skipped answers, and withdrawal. Confirm these pilot submissions do not enter the production dataset.
6. Check the survey on a desktop browser and on a mobile/touch browser. Automated tests alone do not establish visual or accessibility acceptance.
7. Note the current live Netlify production branch in the dashboard. **Do not assume the GitHub default branch is the Netlify production branch**; this repo's default `main` contains a different minimal site rather than the survey's `public/index.html`.
8. When the user approves the production cutover, change only the Netlify production branch (or deploy the tested V10.2 release branch to the existing site). Keep the same Netlify site ID and public domain, so the existing QR code remains valid.
9. Check `/api/health` returns `study: THE SEAM V10.2`. Verify normal survey route and `/?report=1` researcher login separately. **Do not enter fabricated test responses into the official production research dataset**.
10. If anything fails, revert the Netlify production deploy/branch to the recorded V9 version. This restores the previous UI and data store; the V10.2 store remains separately preserved.

## Rollout status
- Code: staged
- Original V9 researcher layout: restored (updated only for mathematically necessary V10.2 labels)
- Automated unit/integration checks: required to pass for final release commit
- Manual browser + Netlify preview: pending
- Approved research contact details and consent: pending
- Original public Netlify site: **not changed**
