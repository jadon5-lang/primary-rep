# THE SEAM — V9 PREVIEW ACCEPTANCE CHECKLIST

Status: staging package prepared, **not production verified**.

1. Upload source files to GitHub's `v9-staging` branch (not `main`). Keep the same `public/`, `lib/`, `netlify/`, and `tests/` directory structure. Do not upload secrets.
2. Confirm that Netlify is linked to the correct repository and uses a deploy preview or branch deploy for the staging branch. Do not publish the staging branch as production.
3. On Netlify, replace the researcher password with a **new, unshared** value for `SEAM_RESEARCHER_PASSWORD`, marked `Contains secret values`, available to Functions in the desired contexts. Deploy again after changing a secret.
4. Open the preview URL and `/api/health`; it must report `ok:true`, `shared_storage:true` and `study:"THE SEAM V9"`.
5. From two independent browser sessions, submit two **clearly labeled test entries** to the preview. Confirm distinct IDs and 2 entries in the protected findings report. Verify a repeat submission recovers the original ID.
6. Download the `.xlsx` report and CSV. Open both and confirm exactly 2 records, all 9 answers and timestamps. Compare coordinates to the participant visualization.
7. Confirm that the preview does not see any historical production records or modify production totals; check server logs for errors.
8. Have the applicable institutional ethics/consent process approved before recruiting participants. Only after approval and successful preview checks, schedule the production update.

Note: Because the existing Netlify site is currently a manually deployed one-file project, connecting it to a Git repository is a separate change to be made only after the staging build has been verified.
