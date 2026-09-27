'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToastStore } from '@/store/toast.store';
import { deleteLead } from '@/lib/actions/kamnet';
import type { Lead } from '@/types/kamnet';

/**
 * Confirmation before removing a prospect.
 *
 * A prospect is a person the agent has spoken to, and the row carries the only
 * record of that conversation. So the delete is confirmed rather than immediate,
 * and the dialog names the client so the agent can see which row they are about
 * to remove - a confirmation that does not say what it is confirming is a
 * formality.
 *
 * The removal is a soft delete on the API side (`deletedAt`, `deletedBy`), so
 * the row leaves the agent's list without leaving the database. The copy says
 * the action cannot be undone FROM THE SCREEN, which is true, rather than
 * claiming the data is gone, which is not.
 */
export const ProspectDeleteDialog = ({ lead, onClose }: { lead: Lead; onClose: () => void }) => {
  const t = useTranslations('app.prospects');
  const { createToast } = useToastStore();
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      const result = await deleteLead(lead.id, '/agent/prospects');
      createToast(
        result.success
          ? { status: 'success', title: t('deleted') }
          : { status: 'error', title: result.error ?? t('failed') },
      );
      if (result.success) onClose();
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('deleteTitle')}</DialogTitle>
          <DialogDescription>
            {lead.clientName} - {t('deleteBody')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {t('cancel')}
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {t('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
