import { toCertificateVerdict } from './certificate-verdict';

const KCA = 'KCA-20250101-0001';

/** The body the API returns for a certificate it holds, valid today. */
const held = (overrides: Record<string, unknown> = {}) => ({
  status: 'VALID',
  valid: true,
  revoked: false,
  revokedAt: null,
  isExpired: false,
  kcaNumber: KCA,
  issueDate: '2025-01-01T00:00:00.000Z',
  validUntil: '2027-01-01T00:00:00.000Z',
  candidateId: '00000000-0000-4000-8000-000000000001',
  ...overrides,
});

describe('toCertificateVerdict', () => {
  // ----- THE NEGATIVE VERDICTS, which are the point ----- //

  it('reads the API answer for an unknown number as not recognised, never as valid', () => {
    // The exact body KbsCertificatesService.verifyCertificate returns when the
    // register holds no such number. The page this replaced said "valid" here.
    const verdict = toCertificateVerdict('KCA-00000000-FAKE', {
      status: 'UNKNOWN',
      valid: false,
      message: 'Certificat introuvable',
    });

    expect(verdict).toEqual({ kind: 'unknown' });
  });

  it('gives no positive verdict for an answer about a different number', () => {
    expect(toCertificateVerdict('KCA-00000000-FAKE', held())).toEqual({ kind: 'unavailable' });
  });

  it('gives no positive verdict when a field of the yes is missing', () => {
    // An answer from an API that does not state revocation cannot be read as
    // "not revoked": that is precisely the defect the API carried until now.
    const withoutRevoked: Record<string, unknown> = held();
    delete withoutRevoked.revoked;
    expect(toCertificateVerdict(KCA, withoutRevoked)).toEqual({ kind: 'unavailable' });
  });

  it('gives no positive verdict when valid and revoked disagree', () => {
    expect(toCertificateVerdict(KCA, held({ revoked: true }))).toEqual({ kind: 'unavailable' });
  });

  it('gives no positive verdict for something that is not an answer', () => {
    for (const body of [null, undefined, '', 'valid', true, [], 42]) {
      expect(toCertificateVerdict(KCA, body).kind).not.toBe('valid');
    }
  });

  // ----- THE REGISTER'S OWN DISTINCTIONS ----- //

  it('reads a revoked certificate as revoked', () => {
    const verdict = toCertificateVerdict(
      KCA,
      held({
        status: 'REVOKED',
        valid: false,
        revoked: true,
        revokedAt: '2026-09-01T10:00:00.000Z',
      }),
    );

    expect(verdict).toEqual({
      kind: 'revoked',
      kcaNumber: KCA,
      issueDate: '2025-01-01T00:00:00.000Z',
      revokedAt: '2026-09-01T10:00:00.000Z',
    });
  });

  it('reads an expired certificate as expired', () => {
    const verdict = toCertificateVerdict(
      KCA,
      held({
        status: 'EXPIRED',
        valid: false,
        isExpired: true,
        validUntil: '2025-06-01T00:00:00.000Z',
      }),
    );

    expect(verdict.kind).toBe('expired');
  });

  it('reads a complete, agreeing yes about the asked number as valid', () => {
    expect(toCertificateVerdict(KCA, held())).toEqual({
      kind: 'valid',
      kcaNumber: KCA,
      issueDate: '2025-01-01T00:00:00.000Z',
      validUntil: '2027-01-01T00:00:00.000Z',
    });
  });
});
