'use client';

import type { FC } from 'react';
import { useTranslations } from 'next-intl';
import type { LandReservationDetail } from '@/types/lands';

interface Props {
  requiredDocs: LandReservationDetail['requiredDocuments'];
  uploadedCount: number;
  isAdmin: boolean;
  onReject: (documentId: string) => void;
  rejectError: string | null;
}

export const ReservationClientDocumentsPanel: FC<Props> = ({
  requiredDocs,
  uploadedCount,
  isAdmin,
  onReject,
  rejectError,
}) => {
  const t = useTranslations('app.reservations');

  if (requiredDocs.length === 0) return null;

  return (
    <div className="rounded-md border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{t('clientDocsCardTitle')}</h2>
        <span className="text-xs text-slate-500">
          {t('clientDocsProgress', { uploaded: uploadedCount, total: requiredDocs.length })}
        </span>
      </div>
      <div className="space-y-2">
        {requiredDocs.map((slot) => (
          <div
            key={slot.type}
            className="flex items-center justify-between gap-3 rounded-sm border border-slate-100 p-2 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{t(`docType.${slot.type}`)}</p>
              {slot.document && (
                <p className="truncate text-xs text-slate-500">{slot.document.name}</p>
              )}
            </div>
            {slot.document ? (
              <div className="flex items-center gap-3">
                <a
                  href={slot.document.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-primary-600 hover:underline"
                >
                  {t('view')}
                </a>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => slot.document && onReject(slot.document.id)}
                    className="text-xs font-medium text-destructive hover:underline"
                  >
                    {t('rejectButton')}
                  </button>
                )}
              </div>
            ) : (
              <span className="text-xs text-slate-400">{t('missing')}</span>
            )}
          </div>
        ))}
      </div>
      {rejectError && <p className="mt-3 text-xs text-destructive">{rejectError}</p>}
    </div>
  );
};
