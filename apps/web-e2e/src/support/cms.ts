/**
 * A71 - the public pages whose body is a Sanity document.
 *
 * Built without `NEXT_PUBLIC_SANITY_PROJECT_ID` and `NEXT_PUBLIC_SANITY_DATASET`,
 * the web has no delivery client and each of these pages answers 404. The E2E
 * job sets `E2E_CMS_CONTENT` from those two repository variables, so the checks
 * that need these pages are skipped exactly while the environment under test
 * was built without a Sanity project, and run again on the first build with one.
 *
 * Pinned against the pages that import `@/lib/cms/documents` by
 * `env-switched-tests-run-somewhere.spec.ts`, in both directions.
 */
export const CMS_PAGES = [
  '/about',
  '/methode',
  '/plan',
  '/products/verify',
  '/legal/privacy',
  '/legal/terms',
  '/legal/mentions',
  '/legal/rgpd',
];

export const CMS_SKIP_REASON =
  'A71: the environment was built without a Sanity project and dataset, so this page answers 404';
