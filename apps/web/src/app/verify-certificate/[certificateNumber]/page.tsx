import { ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import Navbar from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { verifyCertificate } from '@/lib/actions/kbs';
import type { CertificateVerdict } from '@/lib/certificate-verdict';
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

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <div className="mx-auto max-w-md px-6 py-20 sm:px-8">
          <div
            className="rounded-3xl border-2 border-border bg-white p-10 text-center shadow-lg"
            data-verdict={verdict.kind}
          >
            <Verdict verdict={verdict} requested={certificateNumber} />
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Retour à l&apos;accueil</Link>
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}

function Verdict({ verdict, requested }: { verdict: CertificateVerdict; requested: string }) {
  switch (verdict.kind) {
    case 'valid':
      return (
        <>
          <Seal tone="success" icon={<ShieldCheck className="size-10 text-success" />} />
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Certificat valide</h1>
          <p className="mb-8 text-sm text-gray-500">
            Ce certificat KCA a été délivré par KAMBRIQ et est en cours de validité.
          </p>
          <Details
            rows={[
              ['Numéro KCA', verdict.kcaNumber, true],
              ['Délivré le', formatDate(verdict.issueDate)],
              ['Valide jusqu’au', formatDate(verdict.validUntil)],
            ]}
          />
        </>
      );
    case 'revoked':
      return (
        <>
          <Seal tone="danger" icon={<ShieldX className="size-10 text-red-500" />} />
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Certificat révoqué</h1>
          <p className="mb-8 text-sm text-gray-500">
            Ce certificat KCA a été délivré par KAMBRIQ puis révoqué. Il n’est plus valide.
          </p>
          <Details
            rows={[
              ['Numéro KCA', verdict.kcaNumber, true],
              ['Délivré le', formatDate(verdict.issueDate)],
              ...(verdict.revokedAt
                ? ([['Révoqué le', formatDate(verdict.revokedAt)]] as const)
                : []),
            ]}
          />
        </>
      );
    case 'expired':
      return (
        <>
          <Seal tone="warning" icon={<ShieldAlert className="size-10 text-amber-500" />} />
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Certificat expiré</h1>
          <p className="mb-8 text-sm text-gray-500">
            Ce certificat KCA a été délivré par KAMBRIQ, mais sa période de validité est terminée.
            Il n’atteste plus d’une certification en cours.
          </p>
          <Details
            rows={[
              ['Numéro KCA', verdict.kcaNumber, true],
              ['Délivré le', formatDate(verdict.issueDate)],
              ['Expiré le', formatDate(verdict.validUntil)],
            ]}
          />
        </>
      );
    case 'unknown':
      return (
        <>
          <Seal tone="danger" icon={<ShieldX className="size-10 text-red-500" />} />
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Certificat non reconnu</h1>
          <p className="mb-8 text-sm text-gray-500">
            Aucun certificat délivré par KAMBRIQ ne correspond au numéro{' '}
            <span className="font-mono font-medium">{requested}</span>. Ce numéro n’est pas reconnu.
          </p>
        </>
      );
    case 'unavailable':
      return (
        <>
          <Seal tone="neutral" icon={<ShieldQuestion className="size-10 text-gray-500" />} />
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            Vérification impossible pour le moment
          </h1>
          <p className="mb-8 text-sm text-gray-500">
            Nous ne pouvons pas vérifier le numéro{' '}
            <span className="font-mono font-medium">{requested}</span> en ce moment. Cette page ne
            confirme ni n’infirme son authenticité : réessayez dans quelques minutes.
          </p>
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
