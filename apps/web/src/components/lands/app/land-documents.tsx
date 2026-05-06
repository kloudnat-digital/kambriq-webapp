'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { LandDetailDocument } from '@/types/lands';

interface LandDocumentsProps {
  documents: LandDetailDocument[];
}

export const LandDocuments = ({ documents }: LandDocumentsProps) => {
  const t = useTranslations('app.landDetail');

  if (!documents.length) return null;

  return (
    <div className="mt-5 flex flex-col bg-white p-4 ring-1 ring-slate-900/5 sm:rounded-md">
      <div className="pb-5">
        <h3 className="text-base font-semibold text-slate-900">{t('documentsTitle')}</h3>
      </div>
      <ul className="divide-y divide-slate-100">
        {documents.map((doc) => (
          <li key={doc.id} className="flex items-center justify-between gap-x-6 py-5">
            <div className="min-w-0">
              <p className="text-sm/6 text-slate-900">{doc.name}</p>
            </div>
            <Button size="sm" asChild variant="outline">
              <a href={doc.url} target="_blank" rel="noopener noreferrer">
                {t('download')}
              </a>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
};
