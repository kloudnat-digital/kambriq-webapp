jest.mock('@/i18n/navigation', () => require('@/test-utils/navigation-mock'));
jest.mock('@/components/layout/navbar', () => ({ __esModule: true, default: () => null }));
jest.mock('@/lib/actions/kbs', () => ({ verifyCertificate: jest.fn() }));

import { render, screen } from '@testing-library/react';

import { verifyCertificate } from '@/lib/actions/kbs';
import type { CertificateVerdict } from '@/lib/certificate-verdict';
import VerifyCertificatePage from './page';

const verify = verifyCertificate as jest.MockedFunction<typeof verifyCertificate>;

const renderFor = async (certificateNumber: string) =>
  render(await VerifyCertificatePage({ params: Promise.resolve({ certificateNumber }) }));

// Typed as the action's own return: `TServerActionResponse` distributes over the
// verdict union, so a bare `{ success, data }` literal matches no single member.
const answers = (verdict: CertificateVerdict) =>
  verify.mockResolvedValue({ success: true, data: verdict } as Awaited<
    ReturnType<typeof verifyCertificate>
  >);

/**
 * The public certificate page.
 *
 * Until September 2026 it rendered 'Jean Dupont', score 82, "Certificat valide"
 * for any number at all. The tests people should care about are the negative
 * ones: a number the register does not hold, or a register that cannot be
 * reached, must never produce the word "valide".
 */
describe('/verify-certificate/[certificateNumber]', () => {
  beforeEach(() => jest.clearAllMocks());

  // ----- NEVER A POSITIVE VERDICT WITHOUT ONE FROM THE REGISTER ----- //

  it('says a number the register does not hold is not recognised, and never valid', async () => {
    answers({ kind: 'unknown' });

    const { container } = await renderFor('KCA-00000000-FAKE');

    expect(container.querySelector('[data-verdict]')).toHaveAttribute('data-verdict', 'unknown');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Certificat non reconnu');
    expect(screen.getByText(/n’est pas\s+reconnu/)).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/Certificat valide/);
    expect(container).not.toHaveTextContent(/Jean Dupont/);
    expect(verify).toHaveBeenCalledWith('KCA-00000000-FAKE');
  });

  it('says it cannot verify when the register could not be read', async () => {
    answers({ kind: 'unavailable' });

    const { container } = await renderFor('KCA-20250101-0001');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Vérification impossible/);
    expect(container).not.toHaveTextContent(/Certificat valide/);
  });

  it('says it cannot verify when the action itself fails, rather than erroring or guessing', async () => {
    verify.mockRejectedValue(new Error('boom'));

    const { container } = await renderFor('KCA-20250101-0001');

    expect(container.querySelector('[data-verdict]')).toHaveAttribute(
      'data-verdict',
      'unavailable',
    );
    expect(container).not.toHaveTextContent(/Certificat valide/);
  });

  it('says it cannot verify when the action reports a failure', async () => {
    verify.mockResolvedValue({ success: false, error: 'nope', status: 500 });

    const { container } = await renderFor('KCA-20250101-0001');

    expect(container.querySelector('[data-verdict]')).toHaveAttribute(
      'data-verdict',
      'unavailable',
    );
  });

  it('says a revoked certificate is revoked', async () => {
    answers({
      kind: 'revoked',
      kcaNumber: 'KCA-20250101-0001',
      issueDate: '2025-01-01T00:00:00.000Z',
      revokedAt: '2026-09-01T10:00:00.000Z',
    });

    const { container } = await renderFor('KCA-20250101-0001');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Certificat révoqué');
    expect(container).not.toHaveTextContent(/Certificat valide/);
  });

  // ----- AND THE ONE POSITIVE VERDICT ----- //

  it('shows the certificate the register holds, as valid', async () => {
    answers({
      kind: 'valid',
      kcaNumber: 'KCA-20250101-0001',
      issueDate: '2025-01-01T00:00:00.000Z',
      validUntil: '2027-01-01T00:00:00.000Z',
    });

    await renderFor('KCA-20250101-0001');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Certificat valide');
    expect(screen.getByText('KCA-20250101-0001')).toBeInTheDocument();
  });
});
