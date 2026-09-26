'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, XCircle, Trophy, MapPin, User, Phone, Mail, Calendar } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatXAF } from '@/lib/money';
import type { LandReservation } from '@/types/lands';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'border-amber-300 bg-amber-50 text-amber-700',
  CONFIRMED: 'border-blue-300 bg-blue-50 text-blue-700',
  COMPLETED: 'border-success/30 bg-success/10 text-success',
  CANCELLED: 'border-red-300 bg-red-50 text-red-700',
};

type Props = {
  reservation: LandReservation | null;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  onCancel: (id: string, reason: string) => Promise<void>;
};

export function ReservationDetailDialog({
  reservation,
  onClose,
  onConfirm,
  onComplete,
  onCancel,
}: Props) {
  const t = useTranslations('landsAdmin');
  const [cancelMode, setCancelMode] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!reservation) return null;

  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    await fn();
    setLoading(false);
    setCancelMode(false);
    setReason('');
    onClose();
  };

  const canConfirm = reservation.status === 'PENDING';
  const canComplete = reservation.status === 'CONFIRMED';
  const canCancel = reservation.status === 'PENDING' || reservation.status === 'CONFIRMED';

  return (
    <Dialog
      open={!!reservation}
      onOpenChange={(o) => {
        if (!o) {
          setCancelMode(false);
          setReason('');
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('reservations.detailTitle')}</DialogTitle>
          <DialogDescription className="font-mono text-xs">#{reservation.id}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className={cn('text-sm', STATUS_STYLES[reservation.status])}>
              {t(`reservations.status.${reservation.status}`)}
            </Badge>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="size-3.5" />
              {new Date(reservation.createdAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>

          <Separator />

          {/* Land */}
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t('reservations.land')}
            </p>
            <p className="font-semibold text-gray-900">{reservation.land.title}</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" />
              {formatXAF(reservation.land.totalPrice)}
            </div>
          </div>

          {/* Client */}
          <div className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t('reservations.client')}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-1.5 text-gray-700">
                <User className="size-3.5 text-muted-foreground" />
                {reservation.clientName}
              </div>
              <div className="flex items-center gap-1.5 text-gray-700">
                <Phone className="size-3.5 text-muted-foreground" />
                {reservation.clientPhone ?? '-'}
              </div>
              <div className="col-span-2 flex items-center gap-1.5 text-gray-700">
                <Mail className="size-3.5 text-muted-foreground" />
                {reservation.clientEmail}
              </div>
            </div>
          </div>

          <Separator />

          {/* Agent + Deposit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">{t('reservations.agent')}</p>
              <p className="mt-0.5 font-mono text-xs font-semibold text-gray-900">
                {reservation.agentUserId.substring(0, 8)}…
              </p>
            </div>
            <div
              className={cn(
                'rounded-lg border p-3',
                reservation.downPaymentConfirmed
                  ? 'border-success/30 bg-success/5'
                  : 'border-amber-300/50 bg-amber-50/50',
              )}
            >
              <p className="text-xs text-muted-foreground">{t('reservations.deposit')}</p>
              <p className="mt-0.5 text-sm font-bold text-gray-900">
                {formatXAF(reservation.downPaymentAmount)}
              </p>
              <p
                className={cn(
                  'mt-0.5 text-xs font-medium',
                  reservation.downPaymentConfirmed ? 'text-success' : 'text-amber-600',
                )}
              >
                {reservation.downPaymentConfirmed
                  ? t('reservations.depositReceived')
                  : t('reservations.depositPending')}
              </p>
            </div>
          </div>

          {reservation.cancelReason && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="mb-1 text-xs font-medium text-red-600">
                {t('reservations.cancelReason')}
              </p>
              <p className="text-sm text-red-700">{reservation.cancelReason}</p>
            </div>
          )}

          {/* Cancel form */}
          {cancelMode && (
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason" className="text-sm text-red-600">
                {t('reservations.cancelReasonLabel')} *
              </Label>
              <Textarea
                id="cancel-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('reservations.cancelReasonPlaceholder')}
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {cancelMode ? (
            <>
              <Button variant="outline" onClick={() => setCancelMode(false)} disabled={loading}>
                {t('form.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => run(() => onCancel(reservation.id, reason))}
                disabled={loading || !reason.trim()}
              >
                <XCircle className="size-4" />
                {t('reservations.action.confirmCancel')}
              </Button>
            </>
          ) : (
            <>
              {canCancel && (
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setCancelMode(true)}
                  disabled={loading}
                >
                  <XCircle className="size-4" />
                  {t('reservations.action.cancel')}
                </Button>
              )}
              {canConfirm && (
                <Button
                  variant="outline"
                  className="border-blue-300 text-blue-600"
                  onClick={() => run(() => onConfirm(reservation.id))}
                  disabled={loading}
                >
                  <CheckCircle2 className="size-4" />
                  {t('reservations.action.confirm')}
                </Button>
              )}
              {canComplete && (
                <Button onClick={() => run(() => onComplete(reservation.id))} disabled={loading}>
                  <Trophy className="size-4" />
                  {t('reservations.action.complete')}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
