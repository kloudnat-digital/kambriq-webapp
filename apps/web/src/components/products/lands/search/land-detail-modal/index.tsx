'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { MockLand } from '@/data/mock-lands';
import { type SubDialog } from './constants';
import { ModalBody } from './body';
import { ProspectDialog, ReservationDialog, DocsDialog, SupportDialog } from './dialogs';

type LandDetailModalProps = {
  land: MockLand | null;
  onClose: () => void;
};

export default function LandDetailModal({ land, onClose }: LandDetailModalProps) {
  const t = useTranslations('landSearch');
  const [subDialog, setSubDialog] = useState<SubDialog>(null);

  function handleMainClose() {
    setSubDialog(null);
    onClose();
  }

  return (
    <>
      <Dialog
        open={!!land}
        onOpenChange={(open) => {
          if (!open) handleMainClose();
        }}
      >
        <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
          <DialogTitle className="sr-only">{land?.title ?? ''}</DialogTitle>
          <DialogDescription className="sr-only">
            {land?.city}, {land?.region}
          </DialogDescription>
          {land && <ModalBody land={land} t={t} onSubDialog={setSubDialog} />}
        </DialogContent>
      </Dialog>

      {land && (
        <>
          <ProspectDialog
            open={subDialog === 'prospect'}
            onClose={() => setSubDialog(null)}
            land={land}
            t={t}
          />
          <ReservationDialog
            open={subDialog === 'reservation'}
            onClose={() => setSubDialog(null)}
            land={land}
            t={t}
          />
          <DocsDialog open={subDialog === 'docs'} onClose={() => setSubDialog(null)} t={t} />
          <SupportDialog
            open={subDialog === 'support'}
            onClose={() => setSubDialog(null)}
            land={land}
            t={t}
          />
        </>
      )}
    </>
  );
}
