import { evaluate, parse } from 'groq-js';
import {
  LEGAL_POLICY_TYPE,
  POLICY_PUBLISH_FILTER,
  POLICY_PUBLISH_PROJECTION,
} from '@kambriq/common';
import { policyPublishSchema } from '../../cms/policy-publish.dto';

/**
 * The webhook's GROQ filter and projection, evaluated and then handed to the
 * DTO that will receive them.
 *
 * The projection is configuration held by Sanity: nothing in this repository
 * runs it, and a field it stops sending arrives as a 400 in an attempt log. So
 * the string is kept in `libs/common` and evaluated here with `groq-js`, which
 * is the same GROQ implementation the Studio ships, against a document shaped
 * as `studio/schemaTypes/legalPolicy.ts` defines one.
 *
 * What this cannot prove is that the webhook in Sanity carries this string.
 * `scripts/sanity/upsert-policy-webhook.ts` is what makes that true, and
 * `--check` is what reads it back.
 */
const DOCUMENT = {
  _id: 'legalPolicy.legal-privacy.fr',
  _rev: 'rev-Ab12Cd34',
  _type: LEGAL_POLICY_TYPE,
  _createdAt: '2026-09-20T08:00:00.000Z',
  _updatedAt: '2026-09-25T09:59:00.000Z',
  title: 'Politique de confidentialite',
  slug: 'legal-privacy',
  language: 'fr',
  publishedAt: '2026-09-25T10:00:00.000Z',
  body: [
    {
      _type: 'block',
      _key: 'b1',
      style: 'h1',
      children: [{ _type: 'span', _key: 's1', text: 'Confidentialite', marks: [] }],
    },
  ],
};

const OTHER_DOCUMENT = { _id: 'somethingElse.1', _type: 'blogPost', title: 'Not a policy' };

const run = async (query: string, dataset: unknown[]): Promise<unknown> => {
  const value = await evaluate(parse(query), { dataset });
  return value.get();
};

const project = (projection: string, document: unknown = DOCUMENT) =>
  run(`*[${POLICY_PUBLISH_FILTER}]${projection}[0]`, [document, OTHER_DOCUMENT]);

describe('the policy publish webhook projection', () => {
  it('selects the policy and leaves every other document alone', async () => {
    const selected = (await run(`*[${POLICY_PUBLISH_FILTER}]._id`, [
      DOCUMENT,
      OTHER_DOCUMENT,
    ])) as string[];

    expect(selected).toEqual([DOCUMENT._id]);
  });

  it('sends the fields the archive needs, and no others', async () => {
    const payload = (await project(POLICY_PUBLISH_PROJECTION)) as Record<string, unknown>;

    expect(Object.keys(payload).sort()).toEqual([
      '_id',
      '_rev',
      '_type',
      'body',
      'locale',
      'publishedAt',
      'slug',
    ]);
  });

  it('renames the Studio language field to the locale the DTO declares', async () => {
    const payload = (await project(POLICY_PUBLISH_PROJECTION)) as Record<string, unknown>;

    expect(payload['locale']).toBe('fr');
    // `language` is the Studio's name for it and must not arrive under that name:
    // the DTO would strip it and archive a row with no locale at all.
    expect(payload).not.toHaveProperty('language');
  });

  it('produces a payload the DTO accepts', async () => {
    const payload = await project(POLICY_PUBLISH_PROJECTION);

    const parsed = policyPublishSchema.parse(payload);
    expect(parsed).toMatchObject({
      _id: DOCUMENT._id,
      _rev: DOCUMENT._rev,
      locale: 'fr',
      slug: 'legal-privacy',
      publishedAt: DOCUMENT.publishedAt,
    });
    expect(parsed.body).toHaveLength(1);
  });

  /**
   * The seam, watched failing rather than asserted. Each of these is the
   * projection as it would be if somebody removed one field while editing it in
   * Sanity, and each has to reach the DTO as a refusal.
   */
  it.each([
    ['_rev', '{_id, _type, "locale": language, slug, publishedAt, body}'],
    ['locale', '{_id, _rev, _type, slug, publishedAt, body}'],
    ['slug', '{_id, _rev, _type, "locale": language, publishedAt, body}'],
    ['publishedAt', '{_id, _rev, _type, "locale": language, slug, body}'],
    ['body', '{_id, _rev, _type, "locale": language, slug, publishedAt}'],
  ])('is refused by the DTO when it stops sending %s', async (_field, projection) => {
    const payload = await project(projection);

    expect(policyPublishSchema.safeParse(payload).success).toBe(false);
  });

  it('is refused when the language field is renamed in the Studio', async () => {
    // The projection reads `language`. A schema that called it `locale` would
    // project null, which is the drift this file exists to catch.
    const renamed = { ...DOCUMENT, language: undefined, locale: 'fr' };

    expect(
      policyPublishSchema.safeParse(await project(POLICY_PUBLISH_PROJECTION, renamed)).success,
    ).toBe(false);
  });
});
