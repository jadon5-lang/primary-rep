# THE SEAM V9 | Architecture and research integrity audit

**Purpose**: preserve the existing public Netlify URL, participant interface, and three-color interactive pyramid while making collected data dependable and reportable.

- Existing shared dataset retained: production blob store `the-seam-verified-responses-v8`. Unlike isolated test files, this store persists across redeployments. Preview deploys use deploy-scoped storage.
- A successful submission is confirmed by the server, receives a 100–999 ID, and cannot be edited through the participant UI. On an uncertain network failure, re-trying the same browser token recovers any already saved response instead of creating another record.
- All submitted records are used for the protected 3D graph and report; only Q1–Q3 can be included on a public collective map after minimum group count, and access requires a submitted browser token. Public map excludes IDs, timestamps and Q4–Q9.
- Chart math: positions are the centroid of three four-step axes (rating 1 at origin, 4 at vertex). Z height = (Q1+Q2+Q3-3)/9*205. Two students with equal ratios but different totals may share X/Y and differ on Z.
- The private report computes mean/median scores and counts for each question and exports anonymous rows and a question key. Pearson correlation between (Q1+Q2+Q3) and mean(Q4–Q6) is suppressed for fewer than 5 records or zero variation. Association is descriptive, not causal.
- Multiple respondents with identical coordinates can be selected in the researcher inspector by their unique IDs. Stored timestamps are ISO UTC; UI renders `America/New_York` with EST/EDT seasonality.
- Private `SEAM_RESEARCHER_PASSWORD` must be configured in Netlify environment variables. Not committed or sent to students. System fails closed for researcher access if absent.
- All columns are anonymous ratings, IDs and timestamp. QR code and site address can remain the same when deploying this version.

**Limitations**: Anonymous browser token prevents duplicate records from the same participating browser; it does not guarantee one response per person across browsers/devices. Three-digit IDs support a maximum of 900 responses. Strong consistency may cost latency. Review ethics/consent approval before actual research.

## V9 staging hardening (2026-11-08)
- Corrected a possible preview-to-production data leakage risk: the Netlify function now reads the runtime `context.deploy.context` rather than relying on build-only `process.env.CONTEXT`.
- Blocks function operations if deployment context is unavailable instead of silently using production.
- Added a deployment context isolation test and `.gitignore` for local secrets.
- Added `STAGING_CHECKLIST.md` with nonproduction acceptance checks and password rotation instructions.
- No researcher password or participant data added to the code or ZIP.
