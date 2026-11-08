# THE SEAM | Consolidated Findings System (V9)

## The design change
The public participant survey remains at `/`. The former separate `/researcher.html` interface is removed. Instead, a password-protected Findings & Export mode appears at `/?report=1` on the SAME website.

## What happens when a student submits?
- The server records nine 1–4 answers and a UTC timestamp in persistent Netlify Blobs.
- It atomically reserves a unique **three-digit ID 100–999** using a conditional `onlyIfNew` write. Maximum unique capacity: 900 students. No IDs or points are preloaded.
- Submission is rejected if the same browser token is submitted again, but this is not a guarantee against a person using another browser/device. Student names, emails, and institution-issued IDs are not asked for.
- A confirmation popup displays the anonymous ID and the student's marker. The participant's results are locked.
- At least five submissions are required before students see other anonymous group dots, to reduce identifiability.

## What does the private report contain?
- Live 3D triangular/pyramid view; hover/tap for ID, server-recorded timestamp displayed in EST/EDT, family/finance/evaluation ratings and total pressure
- Automatic descriptive narrative, mean and median pressure, mean Q4–Q6 concealment behavior, distributions for Q1–Q9, and participant table
- Excel (.xlsx) download: `Findings Summary`, `Anonymous Responses` (all nine ratings, coordinates and Eastern time), `Question Key`
- CSV download and browser Print / Save PDF
- Updates every 3 seconds while visible. Netlify Blobs listing may propagate with a brief delay.

## Deploying to your existing Netlify URL
Use the existing Netlify site's Agent interface and paste `NETLIFY_AGENT_PROMPT.txt`, attaching the whole ZIP if available. Ask it to deploy the whole project with its Netlify Functions, not just upload the static HTML folder. Preserve `https://the-seam-survey.netlify.app/`.

One private setting is required: Netlify Project Configuration > Environment Variables: `SEAM_RESEARCHER_PASSWORD` = a strong secret of at least 12 characters. Don't include the secret in the website HTML or give it to students. The Findings URL will be `https://the-seam-survey.netlify.app/?report=1` after deployment.

## Check the live backend
`https://the-seam-survey.netlify.app/api/health` must return JSON including `"ok":true`, `"shared_storage":true` and `"study":"THE SEAM V9"`. If it returns 404 or a failure, do NOT collect survey data.

Then submit from two independent devices. Check the private report increases from 0 to 2 and assigns two different 3-digit IDs, both points are shown, and the Excel file includes two rows.

## Limits
- Formal thesis research may require ethics review, informed consent and data management approval.
- Online users can clear browser data or change devices and submit again; without participant identity or one-time distributed invitations, one-person-only enforcement cannot be guaranteed.
- Netlify usage limits and function storage costs may apply. QR scans themselves do not require a paid QR service.
- Existing browser-local submissions are not transferable to the cloud unless separately exported or migrated. V9 uses a new store so fake/legacy responses aren't silently mixed in with verified records.
- Your existing QR code will keep working if its target is the unchanged public URL.

## Security and integrity refinements in V9
- The public diagram requires proof of a completed submission (an anonymous device token) and never exposes other students' three-digit IDs, timestamps, or supporting Q4–Q9 answers.
- The researcher must log in through the password-protected `/api/research` endpoint; no researcher results are embedded in public HTML.
- An interrupted successful submission can be restored on retry without assigning an additional ID.
- Production reuses the V8 site-wide response store, preserving any legitimate existing responses; deploy previews use an isolated store.
- The point inspector offers an ID selector when multiple participants occupy exactly the same 3D position.
- Unique IDs and browser tokens don't establish unique human identities. Anonymous participation is incompatible with guaranteed one-person-only submissions without distributed invitations or additional verification.

## DO NOT publish until checked
1. Keep the existing website URL (`https://the-seam-survey.netlify.app/`). Deploy this entire source project, **not** just `public/index.html`.
2. Set a private `SEAM_RESEARCHER_PASSWORD` environment variable (12+ characters) for Netlify Functions; never put it in HTML, ZIP, source code, or a QR.
3. Open `/api/health` and verify `ok:true`, `shared_storage:true`, and `THE SEAM V9`.
4. Submit once on device A and once on device B; the IDs must differ and the private report must show both (with refresh).
5. Export Excel and verify both response rows. Verify a second attempt from device A restores its original ID rather than creating another row.
6. Confirm no real student information is collected before any university/IRB-required review, consent, and privacy setup.

## V9 staging safety patch — 8 November 2026
The server function now selects production data only when Netlify's *runtime* `context.deploy.context` explicitly equals `production`. Every known nonproduction context uses a deploy-specific store. Unknown contexts return HTTP 503 rather than risking a write to production or quietly saving research into an ephemeral store. The researcher password is never included in this package; configure a new private value directly in Netlify as a secret with Functions runtime scope. A secret changed after deployment requires a fresh deploy to take effect.

This patch has only been locally tested with mocks. Netlify deploy preview acceptance checks, concurrency behavior under real requests, and actual .xlsx generation still require live verification. The package should not be published directly to the existing production URL yet.
