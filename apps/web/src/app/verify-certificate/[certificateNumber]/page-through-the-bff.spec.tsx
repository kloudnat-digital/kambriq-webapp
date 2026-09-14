jest.mock('@/components/layout/navbar', () => ({ __esModule: true, default: () => null }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));
// Only the HTTP client is replaced. The page, the server action and the verdict
// mapping are the real ones - `page.spec.tsx` mocks the action and so cannot
// prove what this file proves.
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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';

import { api, ApiError } from '@/lib/api/server';
import VerifyCertificatePage from './page';

const get = api.get as jest.MockedFunction<typeof api.get>;

const renderFor = async (certificateNumber: string) =>
  render(await VerifyCertificatePage({ params: Promise.resolve({ certificateNumber }) }));

/**
 * The page, end to end down to the HTTP client.
 *
 * The rule under test: **when the register cannot be read, the page says so and
 * says nothing else.** Not "valid", which was the old page's answer to
 * everything, and not "non reconnu", which would call a real certificate a fake
 * because our API was down.
 */
describe('/verify-certificate through the BFF', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    [
      'the API answers 500',
      () => get.mockRejectedValue(new ApiError('Internal server error', 500)),
    ],
    ['the API is unreachable', () => get.mockRejectedValue(new TypeError('fetch failed'))],
    ['the API is throttling', () => get.mockRejectedValue(new ApiError('Too many requests', 429))],
    ['the API answers with something that is not a verdict', () => get.mockResolvedValue('<html>')],
  ])('when %s, it renders "cannot verify" and no verdict', async (_case, arrange) => {
    arrange();

    const { container } = await renderFor('KCA-20250101-0001');

    expect(container.querySelector('[data-verdict]')).toHaveAttribute(
      'data-verdict',
      'unavailable',
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Vérification impossible pour le moment',
    );
    expect(container).toHaveTextContent('ne confirme ni n’infirme son authenticité');
    expect(container).not.toHaveTextContent(/Certificat valide/);
    expect(container).not.toHaveTextContent(/non reconnu/);
  });

  it('renders "non reconnu" for the answer the API gives about an unknown number', async () => {
    get.mockResolvedValue({ status: 'UNKNOWN', valid: false, message: 'Certificat introuvable' });

    const { container } = await renderFor('KCA-00000000-FAKE');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Certificat non reconnu');
    expect(container).not.toHaveTextContent(/Certificat valide/);
    expect(get).toHaveBeenCalledWith('/kbs/public/verify/KCA-00000000-FAKE');
  });

  it('is a server component that reads through a server action, never a browser fetch', () => {
    // This codebase has no client-reachable data API. A 'use client' page would
    // have to fetch from the browser, which is exactly what must not exist.
    const page = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    const action = readFileSync(join(__dirname, '../../../lib/actions/kbs.ts'), 'utf8');

    expect(page).not.toMatch(/^\s*['"]use client['"]/m);
    expect(page).not.toMatch(/\bfetch\(/);
    expect(page).toContain("from '@/lib/actions/kbs'");
    expect(action.trimStart().startsWith("'use server'")).toBe(true);
    expect(action).toContain("from '@/lib/api/server'");
  });
});
