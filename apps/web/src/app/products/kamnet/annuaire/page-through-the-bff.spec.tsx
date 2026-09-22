jest.mock('next-intl/server', () => require('@/test-utils/next-intl-mock'));
jest.mock('@/components/layout/navbar', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/layout/footer', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/floating/quick-actions', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/products/kamnet/certificate-number-lookup', () => ({
  CertificateNumberLookup: () => null,
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));
// Only the HTTP client is replaced. The page and the server action are the real
// ones - `page.spec.tsx` mocks the action and so cannot prove what this proves.
jest.mock('@/lib/api/server', () => {
  class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
      this.name = 'ApiError';
    }
  }
  return { ApiError, api: { get: jest.fn() }, serverApi: {} };
});

import { render, screen } from '@testing-library/react';

import { api, ApiError } from '@/lib/api/server';
import AgentDirectoryPage from './page';

const get = api.get as jest.MockedFunction<typeof api.get>;

const renderPage = async () => render(await AgentDirectoryPage());

/**
 * P11 - what crosses the boundary onto a public page, end to end.
 *
 * ---------------------------------------------------------------------------
 * Asserted by ABSENCE, because presence proves nothing
 * ---------------------------------------------------------------------------
 * A projection that accidentally spread the whole agent record would still
 * carry the seven fields a page renders, and would pass any test that only
 * checked they were there. So the API is made to answer with a deliberately
 * OVER-BROAD body - every field the subject forbids, plus a couple it never
 * mentions - and the assertion is that none of them reaches the DOM.
 *
 * The server refuses these in `toPublicDirectoryEntry`, which is proved
 * separately in `kamnet-public-directory.dbspec.ts` against three real
 * databases. This is the other half: even if the API regressed and sent them,
 * the page would not publish them. Two independent defences, because the thing
 * being protected is a real person's identity on an anonymous page.
 *
 * `referralCount` matters most of the list: it is the recruitment metric the
 * P9 arbitrage removed from the public site on 20 September.
 */
describe('/products/kamnet/annuaire through the BFF', () => {
  beforeEach(() => jest.clearAllMocks());

  const OVER_BROAD = {
    firstName: 'Amina',
    lastName: 'Nkolo',
    city: 'Douala',
    country: 'CM',
    avatarUrl: 'avatars/amina.png',
    kcaNumber: 'KCA-20250101-0001',
    certifiedSince: '2025-01-01T00:00:00.000Z',
    // None of the below may reach a stranger. The two counts carry deliberately
    // distinctive values: a `salesCount` of 17 or a `referralCount` of 9 would
    // be a substring of a date, a KCA number or a Tailwind class, so a failure
    // could never be read as "this field leaked" with any confidence.
    salesCount: 4217,
    referralCount: 4299,
    tier: 'MANAGER',
    agentCode: 'AGT-2025-0001',
    sponsor: { id: 'a1', agentCode: 'AGT-2025-0000' },
    bio: 'Terrain Douala depuis 2019',
    email: 'amina.nkolo@example.test',
    phone: '+237600000001',
    address: '15 rue de la Paix, Douala',
    userId: 'user-uuid-0001',
  };

  it('publishes the seven public fields and none of the rest', async () => {
    get.mockResolvedValue([OVER_BROAD]);

    const { container } = await renderPage();

    // What a reader is here for.
    expect(screen.getByText('Amina Nkolo')).toBeInTheDocument();
    expect(screen.getByText('Douala, CM')).toBeInTheDocument();
    expect(screen.getByText('KCA-20250101-0001')).toBeInTheDocument();

    /**
     * Read from `textContent`, NOT `innerHTML`.
     *
     * The first version of this assertion searched the raw HTML for `'17'` and
     * `'9'` - `salesCount` and `referralCount`. Markup carries class names, so
     * `size-12`, `gap-4` and `bg-primary-500/10` are all candidates for a bare
     * digit: the test could have failed over a Tailwind class or passed by
     * luck, and in neither case would it have been measuring the leak it exists
     * to catch. `textContent` is what a reader actually sees.
     */
    const visible = container.textContent ?? '';

    // Each named so a failure says which one leaked. `4299` is
    // `referralCount` - the recruitment metric the P9 arbitrage removed from
    // the public site on 20 September, and the one this page most needs to
    // never publish.
    for (const forbidden of [
      '4217',
      '4299',
      'MANAGER',
      'AGT-2025-0001',
      'AGT-2025-0000',
      'Terrain Douala',
      'amina.nkolo@example.test',
      '+237600000001',
      'rue de la Paix',
      'user-uuid-0001',
    ]) {
      expect(visible).not.toContain(forbidden);
    }
  });

  it('links the number into the verifier, which is what a reader checks', async () => {
    get.mockResolvedValue([OVER_BROAD]);

    await renderPage();

    expect(screen.getByRole('link', { name: /Vérifier ce numéro/ })).toHaveAttribute(
      'href',
      '/verify-certificate/KCA-20250101-0001',
    );
    expect(get).toHaveBeenCalledWith('/kamnet/public/agents');
  });

  /**
   * The distinction the whole action exists to keep. An outage must not render
   * as "no certified agents", which would be a false statement about the
   * business made to the exact visitor the directory is meant to reassure.
   */
  it.each([
    ['the API is unreachable', () => get.mockRejectedValue(new TypeError('fetch failed'))],
    ['the API answers 500', () => get.mockRejectedValue(new ApiError('boom', 500))],
    ['the answer is not a list', () => get.mockResolvedValue('<html>')],
  ])('says it cannot check when %s, and never that the directory is empty', async (_c, arrange) => {
    arrange();

    const { container } = await renderPage();

    expect(container.querySelector('[data-directory="unavailable"]')).toBeInTheDocument();
    expect(container.querySelector('[data-directory="empty"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-directory="list"]')).not.toBeInTheDocument();
  });

  it('says nobody is published yet when the register is genuinely empty', async () => {
    get.mockResolvedValue([]);

    const { container } = await renderPage();

    expect(container.querySelector('[data-directory="empty"]')).toBeInTheDocument();
    expect(container.querySelector('[data-directory="unavailable"]')).not.toBeInTheDocument();
  });

  /**
   * `page.tsx` reads through a server action, never a browser fetch. Copied
   * from `verify-certificate/page-through-the-bff.spec.ts`, which records why:
   * this codebase has no client-reachable data API, and a `'use client'` page
   * would have to fetch from the browser.
   */
  it('is a server component reading through a server action', () => {
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const page = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

    expect(page).not.toMatch(/^\s*['"]use client['"]/m);
    expect(page).not.toMatch(/\bfetch\(/);
    expect(page).toContain("from '@/lib/actions/kamnet'");
    expect(page).toContain("export const dynamic = 'force-dynamic'");
  });
});
