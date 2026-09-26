import { ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { ReactNode } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';

import Navbar from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { verifyCertificate } from '@/lib/actions/kbs';
import type { CertificateVerdict } from '@/lib/certificate-verdict';
import QuickActions from '@/components/floating/quick-actions';
import { formatDate } from '@/lib/kbs';

// Fetches the verdict from the register on every request to prevent serving stale "valid" results after a revocation.
export const dynamic = 'force-dynamic';

const UNAVAILABLE: CertificateVerdict = { kind: 'unavailable' };

/**
 * Public verification page for KCA certificates.
 * Queries the certificate register and validates authenticity.
 * See `lib/certificate-verdict.ts` for validation rules.
 */
export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ certificateNumber: string }>;
}) {
  const { certificateNumber } = await params;
  const result = await verifyCertificate(certificateNumber).catch(() => null);
  const verdict = result?.success ? result.data : UNAVAILABLE;
  const t = await getTranslations('verifyCertificate');
  const dateLocale = (await getLocale()) === 'en' ? 'en-GB' : 'fr-FR';

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <div className="mx-auto max-w-md px-6 py-20 sm:px-8">
          <div
            className="rounded-3xl border-2 border-border bg-white p-10 text-center shadow-lg"
            data-verdict={verdict.kind}
          >
            <Verdict
              verdict={verdict}
              requested={certificateNumber}
              t={t}
              dateLocale={dateLocale}
            />
            <Button asChild variant="outline" className="w-full">
              <Link href="/">{t('home')}</Link>
            </Button>
          </div>
        </div>
      </main>
      <QuickActions />
    </>
  );
}

type Translator = Awaited<ReturnType<typeof getTranslations<'verifyCertificate'>>>;

/** The requested number, set apart so a reader can compare it with what they typed. */
const numberTag = (chunks: ReactNode) => <span className="font-mono font-medium">{chunks}</span>;

function Verdict({
  verdict,
  requested,
  t,
  dateLocale,
}: {
  verdict: CertificateVerdict;
  requested: string;
  t: Translator;
  dateLocale: string;
}) {
  const date = (iso: string | null | undefined) => formatDate(iso, dateLocale);
  const heading = (kind: CertificateVerdict['kind']) => (
    <>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">{t(`${kind}.title`)}</h1>
      <p className="mb-8 text-sm text-gray-500">
        {t.rich(`${kind}.description`, { requested, number: numberTag })}
      </p>
    </>
  );

  switch (verdict.kind) {
    case 'valid':
      return (
        <>
          <Seal tone="success" icon={<ShieldCheck className="size-10 text-success" />} />
          {heading('valid')}
          <Details
            rows={[
              [t('labels.number'), verdict.kcaNumber, true],
              [t('labels.issued'), date(verdict.issueDate)],
              [t('labels.validUntil'), date(verdict.validUntil)],
            ]}
          />
        </>
      );
    case 'revoked':
      return (
        <>
          <Seal tone="danger" icon={<ShieldX className="size-10 text-red-500" />} />
          {heading('revoked')}
          <Details
            rows={[
              [t('labels.number'), verdict.kcaNumber, true],
              [t('labels.issued'), date(verdict.issueDate)],
              ...(verdict.revokedAt
                ? ([[t('labels.revokedOn'), date(verdict.revokedAt)]] as const)
                : []),
            ]}
          />
        </>
      );
    case 'expired':
      return (
        <>
          <Seal tone="warning" icon={<ShieldAlert className="size-10 text-amber-500" />} />
          {heading('expired')}
          <Details
            rows={[
              [t('labels.number'), verdict.kcaNumber, true],
              [t('labels.issued'), date(verdict.issueDate)],
              [t('labels.expiredOn'), date(verdict.validUntil)],
            ]}
          />
        </>
      );
    case 'unknown':
      return (
        <>
          <Seal tone="danger" icon={<ShieldX className="size-10 text-red-500" />} />
          {heading('unknown')}
        </>
      );
    case 'unavailable':
      return (
        <>
          <Seal tone="neutral" icon={<ShieldQuestion className="size-10 text-gray-500" />} />
          {heading('unavailable')}
        </>
      );
  }
}

const SEAL_TONES = {
  success: 'bg-success/10',
  warning: 'bg-amber-50',
  danger: 'bg-red-50',
  neutral: 'bg-gray-100',
} as const;

function Seal({ tone, icon }: { tone: keyof typeof SEAL_TONES; icon: ReactNode }) {
  return (
    <div
      className={`mx-auto mb-6 flex size-20 items-center justify-center rounded-full ${SEAL_TONES[tone]}`}
    >
      {icon}
    </div>
  );
}

function Details({ rows }: { rows: ReadonlyArray<readonly [string, string, boolean?]> }) {
  return (
    <div className="mb-6 space-y-3 rounded-2xl bg-gray-50 p-5 text-left text-sm">
      {rows.map(([label, value, mono]) => (
        <div key={label} className="flex justify-between">
          <span className="text-gray-500">{label}</span>
          <span className={mono ? 'font-mono font-semibold' : 'font-semibold'}>{value}</span>
        </div>
      ))}
    </div>
  );
}
