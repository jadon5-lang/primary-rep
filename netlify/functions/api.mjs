import { getStore, getDeployStore } from '@netlify/blobs';
import { handleSeamRequest } from '../../lib/handlers.mjs';
import { storageScopeFor } from '../../lib/deploy-safety.mjs';

// V10.2 uses a distinct store because the revised question-specific sliders use distinct constructs; they must not share a dataset with prior pilot questionnaires. Earlier V10 and V9 pilot responses remain separate.
// Nonproduction previews use deploy-specific stores, so tests cannot contaminate the live study.
// Unknown contexts fail closed.
export default async function handler(request, context) {
  const scope = storageScopeFor(context);
  if (scope === 'unverified') {
    return new Response(JSON.stringify({
      ok: false,
      error: 'Deployment context could not be verified; survey operations are disabled.'
    }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
  const store = () => scope === 'site-wide-production'
    ? getStore({ name: 'the-seam-verified-responses-v10-2', consistency: 'strong' })
    : getDeployStore({ name: 'the-seam-verified-responses-v10-2-preview', consistency: 'strong' });
  return handleSeamRequest(request, store);
}
