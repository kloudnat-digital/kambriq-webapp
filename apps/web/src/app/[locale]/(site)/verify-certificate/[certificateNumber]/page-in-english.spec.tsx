jest.mock('next-intl/server', () => require('@/test-utils/next-intl-mock'));
jest.mock('@/components/floating/quick-actions', () => ({ __esModule: true, default: () => null }));
jest.mock('@/i18n/navigation', () => require('@/test-utils/navigation-mock'));
jest.mock('@/components/layout/navbar', () => ({ __esModule: true, default: () => null }));
jest.mock('@/lib/actions/kbs', () => ({ verifyCertificate: jest.fn() }));

import { render, screen } from '@testing-library/react';
import { setTestLocale } from '@/test-utils/next-intl-mock';
import { verifyCertificate } from '@/lib/actions/kbs';
import type { CertificateVerdict } from '@/lib/certificate-verdict';
import VerifyCertificatePage from './page';

const verify = verifyCertificate as jest.MockedFunction<typeof verifyCertificate>;

const renderFor = async (verdict: CertificateVerdict, certificateNumber = 'KCA-20250101-0001') => {
  verify.mockResolvedValue({ success: true, data: verdict } as Awaited<
    ReturnType<typeof verifyCertificate>
  >);
  return render(await VerifyCertificatePage({ params: Promise.resolve({ certificateNumber }) }));
};

/** Words only the French verdicts use; none may reach an English reader. */
const FRENCH =
  /\bCertificat\b|Numéro|Délivré|Valide jusqu|Révoqué|Expiré|Vérification|Retour|accueil|numéro|n’est|réessayez/;

const DATES = { issueDate: '2025-01-01T00:00:00.000Z', validUntil: '2027-01-01T00:00:00.000Z' };

/**
 * The public verdict is read by strangers - a buyer checking an agent before
 * ever meeting KAMBRIQ - and it was French only. Each verdict, in English,
 * reads English throughout, and keeps what the French version guarantees: the
 * number the reader typed, shown back to them.
 */
describe('/verify-certificate/[certificateNumber] in English', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setTestLocale('en');
  });
  afterAll(() => setTestLocale('fr'));

  it.each([
    ['valid', { kind: 'valid', kcaNumber: 'KCA-20250101-0001', ...DATES }, 'Valid certificate'],
    [
      'revoked',
      {
        kind: 'revoked',
        kcaNumber: 'KCA-20250101-0001',
        ...DATES,
        revokedAt: '2026-01-01T00:00:00.000Z',
      },
      'Revoked certificate',
    ],
    [
      'expired',
      { kind: 'expired', kcaNumber: 'KCA-20250101-0001', ...DATES },
      'Expired certificate',
    ],
    ['unknown', { kind: 'unknown' }, 'Certificate not recognised'],
    ['unavailable', { kind: 'unavailable' }, 'Verification unavailable for now'],
  ] as const)('%s reads English throughout', async (_kind, verdict, heading) => {
    const { container } = await renderFor(verdict as CertificateVerdict);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
    expect(container.textContent).not.toMatch(FRENCH);
  });

  it.each([['unknown'], ['unavailable']] as const)(
    '%s shows the number that was asked about, in its own element',
    async (kind) => {
      await renderFor({ kind } as CertificateVerdict, 'KCA-00000000-FAKE');
      expect(screen.getByText('KCA-00000000-FAKE')).toBeInTheDocument();
    },
  );
});
