// A deploy preview must never read or write the site's production responses.
// Netlify's runtime Function context carries deploy.context, unlike the
// build-time CONTEXT variable (which may not be set in Functions).
export const storageScopeFor = (context) => {
  const kind = context?.deploy?.context;
  if (kind === 'production') return 'site-wide-production';
  if (['deploy-preview', 'branch-deploy', 'preview-server', 'dev'].includes(kind)) return 'deploy-specific-preview';
  return 'unverified';
};
