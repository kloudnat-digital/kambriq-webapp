jest.mock('@/lib/api/server', () => ({ api: { get: jest.fn() } }));

import type { CmsDocument } from './documents';
import { policySource, type PolicyStanding } from './policy-standing';

/**
 * C41 - a revision dated in the future is not served as the one in force.
 */
const NOW = new Date('2026-10-02T10:00:00Z');
const doc = (publishedAt: string | null): CmsDocument =>
  ({
    _id: 'd',
    _rev: 'r',
    _type: 'legalPolicy',
    locale: 'fr',
    slug: 's',
    publishedAt,
    body: [{ _type: 'block' }],
  }) as CmsDocument;
const standing = (inForce: boolean): PolicyStanding => ({
  inForce: inForce
    ? { revision: 'old', publishedAt: '2026-09-01T00:00:00Z', rendered: '<p>old</p>' }
    : null,
  upcoming: { revision: 'r', publishedAt: '2026-10-18T22:00:00Z' },
});

describe('C41 - what a legal page serves', () => {
  it('serves Sanity as before when its revision is already in force', () => {
    expect(policySource(doc('2026-09-30T00:00:00Z'), null, NOW)).toBe('document');
    expect(policySource(doc(null), null, NOW)).toBe('document');
  });

  it('serves the archived revision in force when Sanity holds a future one', () => {
    expect(policySource(doc('2026-10-18T22:00:00Z'), standing(true), NOW)).toBe('archive');
  });

  it('announces a future revision when nothing is in force, never serves it as current', () => {
    expect(policySource(doc('2026-10-18T22:00:00Z'), standing(false), NOW)).toBe('upcoming');
    expect(policySource(doc('2026-10-18T22:00:00Z'), null, NOW)).toBe('upcoming');
  });

  it('takes effect on its date', () => {
    expect(
      policySource(doc('2026-10-18T22:00:00Z'), standing(true), new Date('2026-10-18T22:00:00Z')),
    ).toBe('document');
  });

  it('has nothing to serve without a document or an archived revision', () => {
    expect(policySource(null, standing(false), NOW)).toBe('none');
  });
});
