import { Award, Download, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function KbsCertificatePage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-2xl py-10">
        <div className="overflow-hidden rounded-3xl border-2 border-gold-300 bg-gradient-to-br from-gold-50 to-amber-50 shadow-lg">
          {/* Certificate header */}
          <div className="bg-gradient-to-r from-primary-800 to-primary-600 px-8 py-6 text-white">
            <div className="flex items-center gap-3">
              <Award className="size-8 text-gold-400" />
              <div>
                <p className="text-xs font-medium tracking-widest text-primary-200 uppercase">
                  Certificat de réussite
                </p>
                <h1 className="text-lg font-bold">KAMBRIQ Business School</h1>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-10 py-10 text-center">
            <p className="mb-2 text-sm text-gray-500">Ce certificat est décerné à</p>
            <h2 className="mb-1 text-3xl font-bold text-gray-900">Jean Dupont</h2>
            <p className="mb-6 text-sm text-gray-500">
              Pour avoir complété avec succès la formation
            </p>
            <div className="mb-6 rounded-2xl bg-white px-6 py-4 shadow-inner">
              <p className="text-lg font-semibold text-primary-700">Certification KCA</p>
              <p className="text-xs text-gray-400">KAMBRIQ Certified Agent</p>
            </div>
            <div className="mb-8 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-400">Score final</p>
                <p className="text-xl font-bold text-gray-900">82/100</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Numéro</p>
                <p className="font-mono text-sm font-bold text-gray-900">KCA-2025-0891</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Date</p>
                <p className="text-sm font-bold text-gray-900">28 fév 2025</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gold-200 bg-white/50 px-8 py-4">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button className="gap-2">
                <Download className="size-4" /> Télécharger PDF
              </Button>
              <Button variant="outline" className="gap-2">
                <Share2 className="size-4" /> Partager
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
