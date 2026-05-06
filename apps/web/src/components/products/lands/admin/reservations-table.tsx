'use client';

import { Search, CheckCircle2, Trophy, Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatXAF } from '@/lib/money';
import type { LandReservation } from '@/types/lands';
import { LAND_RESERVATION_STATUS_STYLES } from '@/constants/land';
import type { FC } from 'react';

type ReservationsTableProps = {
  reservations: LandReservation[];
  search: string;
  status: string;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onConfirm: (id: string) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  onSelect: (res: LandReservation) => void;
};

const ReservationsTable: FC<ReservationsTableProps> = ({
  reservations,
  search,
  status,
  onSearchChange,
  onStatusChange,
  onConfirm,
  onComplete,
  onSelect,
}) => {
  const t = useTranslations('landsAdmin');

  return (
    <>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('reservations.searchPlaceholder')}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('reservations.allStatuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('reservations.allStatuses')}</SelectItem>
            <SelectItem value="PENDING">{t('reservations.status.PENDING')}</SelectItem>
            <SelectItem value="CONFIRMED">{t('reservations.status.CONFIRMED')}</SelectItem>
            <SelectItem value="COMPLETED">{t('reservations.status.COMPLETED')}</SelectItem>
            <SelectItem value="CANCELLED">{t('reservations.status.CANCELLED')}</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm text-muted-foreground">
          {reservations.length} {t('lands.results')}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t('table.land')}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t('table.client')}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t('table.agent')}
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  {t('table.deposit')}
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  {t('table.status')}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t('table.date')}
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  {t('table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reservations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                    {t('reservations.noResults')}
                  </td>
                </tr>
              ) : (
                reservations.map((res) => (
                  <tr key={res.id} className="transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{res.land.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatXAF(res.land.price)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{res.clientName}</p>
                      <p className="text-xs text-muted-foreground">{res.clientPhone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-muted-foreground">
                        {res.agentUserId.substring(0, 8)}…
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold">{formatXAF(res.downPaymentAmount)}</p>
                      <p
                        className={cn(
                          'mt-0.5 text-xs',
                          res.downPaymentConfirmed ? 'text-success' : 'text-amber-600',
                        )}
                      >
                        {res.downPaymentConfirmed
                          ? t('reservations.depositReceived')
                          : t('reservations.depositPending')}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant="outline"
                        className={cn('text-xs', LAND_RESERVATION_STATUS_STYLES[res.status])}
                      >
                        {t(`reservations.status.${res.status}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(res.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {res.status === 'PENDING' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 border-blue-300 text-xs text-blue-600"
                            onClick={() => onConfirm(res.id)}
                          >
                            <CheckCircle2 className="size-3" />
                            {t('reservations.action.confirm')}
                          </Button>
                        )}
                        {res.status === 'CONFIRMED' && (
                          <Button
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => onComplete(res.id)}
                          >
                            <Trophy className="size-3" />
                            {t('reservations.action.complete')}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => onSelect(res)}
                        >
                          <Eye className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default ReservationsTable;
