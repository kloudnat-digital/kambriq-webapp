import { ShieldCheck, ShieldX } from 'lucide-react';
import Link from 'next/link';

import Navbar from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';

// In production, fetch from API by certificateNumber
const MOCK_VALID = {
  holderName: 'Jean Dupont',
  kcaNumber: 'KCA-2025-0891',
  issueDate: '28 février 2025',
  score: 82,
  valid: true,
};

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ certificateNumber: string }>;
}) {
  const { certificateNumber } = await params;
  const cert = certificateNumber ? MOCK_VALID : null;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <div className="mx-auto max-w-md px-6 py-20 sm:px-8">
          <div className="rounded-3xl border-2 border-border bg-white p-10 text-center shadow-lg">
            {cert?.valid ? (
              <>
                <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-success/10">
                  <ShieldCheck className="size-10 text-success" />
                </div>
                <h1 className="mb-2 text-2xl font-bold text-gray-900">Certificat valide</h1>
                <p className="mb-8 text-sm text-gray-500">
                  Ce certificat KCA a été délivré par KAMBRIQ et est authentique.
                </p>
                <div className="mb-6 space-y-3 rounded-2xl bg-gray-50 p-5 text-left text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Titulaire</span>
                    <span className="font-semibold">{cert.holderName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Numéro KCA</span>
                    <span className="font-mono font-semibold">{cert.kcaNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Délivré le</span>
                    <span className="font-semibold">{cert.issueDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Score</span>
                    <span className="font-semibold">{cert.score}/100</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-red-50">
                  <ShieldX className="size-10 text-red-500" />
                </div>
                <h1 className="mb-2 text-2xl font-bold text-gray-900">Certificat non trouvé</h1>
                <p className="mb-8 text-sm text-gray-500">
                  Aucun certificat ne correspond au numéro{' '}
                  <span className="font-mono font-medium">{certificateNumber}</span>.
                </p>
              </>
            )}
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Retour à l&apos;accueil</Link>
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
