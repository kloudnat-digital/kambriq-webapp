/**
 * Creates or reconciles the Sanity webhook that fills the policy archive.
 *
 * The filter, the projection and the target path come from
 * `libs/common/src/cms/legal-policy.ts`, which is the same file the API's DTO is
 * built from. Typed into Sanity's dashboard instead, they would be configuration
 * that exists on one project and nowhere in the repository, and a projection
 * that stopped matching the DTO would only be visible as a 400 in an attempt
 * log nobody reads.
 *
 * Run once per Sanity project. It is idempotent: a second run reconciles every
 * field of an existing hook rather than creating a second one.
 *
 *   SANITY_PROJECT_ID=xxxxxxxx \
 *   SANITY_MANAGE_TOKEN=sk... \
 *   SANITY_WEBHOOK_SECRET=... \
 *   KAMBRIQ_API_URL=https://dev.kambriq.com \
 *     npx tsx scripts/sanity/upsert-policy-webhook.ts [--check]
 *
 * The token is a project token with the Developer access level, from the
 * project's API settings: the token dialog offers no Administrator level, and
 * Developer is the one that manages webhooks. It is not the webhook secret and it
 * is not the Studio's login. On dev both values live in SSM, under
 * /kambriq/dev/sanity/SANITY_MANAGE_TOKEN and /kambriq/dev/sanity/SANITY_WEBHOOK_SECRET.
 */
/*
 * A command-line tool belongs to no nx project, so it reaches `libs/common` by
 * path rather than through `@kambriq/common`, exactly as the `prisma/` scripts do.
 */
/* eslint-disable @nx/enforce-module-boundaries */
import {
  POLICY_PUBLISH_FILTER,
  POLICY_PUBLISH_PROJECTION,
  POLICY_WEBHOOK_API_VERSION,
  POLICY_WEBHOOK_NAME,
  POLICY_WEBHOOK_PATH,
} from '../../libs/common/src/cms/legal-policy';

type Hook = {
  id: string;
  name: string;
  url: string;
  dataset: string;
  httpMethod?: string;
  apiVersion?: string;
  isDisabled?: boolean;
  isDisabledByUser?: boolean;
  rule?: { on?: string[]; filter?: string; projection?: string };
};

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required. See the header of this file.`);
  }
  return value;
};

/**
 * Resolved inside `main`, never at module scope: a missing variable must print
 * one line, not a stack trace from an import.
 */
const settings = () => {
  const projectId = required('SANITY_PROJECT_ID');
  return {
    projectId,
    token: required('SANITY_MANAGE_TOKEN'),
    dataset: process.env['SANITY_DATASET']?.trim() || 'production',
    base: `https://${projectId}.api.sanity.io/${POLICY_WEBHOOK_API_VERSION}/hooks/projects/${projectId}`,
  };
};

type Settings = ReturnType<typeof settings>;

const call = async (
  { base, token }: Settings,
  path: string,
  init?: RequestInit,
): Promise<unknown> => {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${base}${path} answered ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
};

/** What the hook must look like when this script is done. */
const desired = (dataset: string) => {
  const apiUrl = required('KAMBRIQ_API_URL').replace(/\/+$/, '');
  return {
    type: 'document',
    name: POLICY_WEBHOOK_NAME,
    description:
      'Archives the rendered text of a published legal policy into PolicySnapshot. Managed by scripts/sanity/upsert-policy-webhook.ts.',
    url: `${apiUrl}${POLICY_WEBHOOK_PATH}`,
    dataset,
    apiVersion: POLICY_WEBHOOK_API_VERSION,
    httpMethod: 'POST',
    // A deletion carries no body to archive, and the archive is append-only, so
    // there is nothing for this hook to do about one.
    rule: {
      on: ['create', 'update'],
      filter: POLICY_PUBLISH_FILTER,
      projection: POLICY_PUBLISH_PROJECTION,
    },
    includeDrafts: false,
    isDisabledByUser: false,
    secret: required('SANITY_WEBHOOK_SECRET'),
  };
};

const describe = (hook: Hook): string =>
  [
    `  id         ${hook.id}`,
    `  url        ${hook.url}`,
    `  dataset    ${hook.dataset}`,
    `  on         ${hook.rule?.on?.join(', ') ?? '-'}`,
    `  filter     ${hook.rule?.filter ?? '-'}`,
    `  projection ${hook.rule?.projection ?? '-'}`,
    `  disabled   ${hook.isDisabled ?? hook.isDisabledByUser ?? false}`,
  ].join('\n');

const main = async () => {
  const config = settings();
  const { projectId, dataset } = config;
  const checkOnly = process.argv.includes('--check');

  const hooks = (await call(config, '')) as Hook[];
  const existing = hooks.find((hook) => hook.name === POLICY_WEBHOOK_NAME);

  if (checkOnly) {
    if (!existing) {
      console.log(`No webhook named ${POLICY_WEBHOOK_NAME} on project ${projectId}.`);
      process.exitCode = 1;
      return;
    }
    console.log(`${POLICY_WEBHOOK_NAME} on project ${projectId}:\n${describe(existing)}`);
    const drifted =
      existing.rule?.filter !== POLICY_PUBLISH_FILTER ||
      existing.rule?.projection !== POLICY_PUBLISH_PROJECTION;
    if (drifted) {
      console.error(
        '\nThe filter or the projection differs from this repository. Re-run without --check.',
      );
      process.exitCode = 1;
    }
    return;
  }

  const body = desired(dataset);
  const written = (await call(config, existing ? `/${existing.id}` : '', {
    method: existing ? 'PATCH' : 'POST',
    body: JSON.stringify(body),
  })) as Hook;

  // Read it back. The response to a write is what the server accepted, not
  // necessarily what it stored, and this hook is the only thing that will ever
  // call the archive.
  const after = (await call(config, `/${written.id}`)) as Hook;
  console.log(`${existing ? 'Updated' : 'Created'} ${POLICY_WEBHOOK_NAME}:\n${describe(after)}`);

  if (
    after.rule?.filter !== POLICY_PUBLISH_FILTER ||
    after.rule?.projection !== POLICY_PUBLISH_PROJECTION
  ) {
    throw new Error('Sanity stored a filter or projection that differs from this repository.');
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
