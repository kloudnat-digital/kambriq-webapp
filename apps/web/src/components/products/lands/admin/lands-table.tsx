'use client';

import {
  Search,
  Eye,
  Pencil,
  Archive,
  MoreHorizontal,
  ShieldCheck,
  CheckCircle2,
  LayoutGrid,
  MapPin,
} from 'lucide-react';
import Image from 'next/image';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatXAF } from '@/lib/money';
import type { AdminLand } from './types';
import { LAND_STATUS_STYLES, LABEL_STYLES } from './constants';

type LandsTableProps = {
  lands: AdminLand[];
  regions: string[];
  search: string;
  region: string;
  label: string;
  status: string;
  onSearchChange: (v: string) => void;
  onRegionChange: (v: string) => void;
  onLabelChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onEdit: (land: AdminLand) => void;
  onTogglePublish: (land: AdminLand) => void;
  onArchive: (land: AdminLand) => void;
};

export function LandsTable({
  lands,
  regions,
  search,
  region,
  label,
  status,
  onSearchChange,
  onRegionChange,
  onLabelChange,
  onStatusChange,
  onEdit,
  onTogglePublish,
  onArchive,
}: LandsTableProps) {
  const t = useTranslations('landsAdmin');

  return (
    <>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('lands.searchPlaceholder')}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={region} onValueChange={onRegionChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('lands.allRegions')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('lands.allRegions')}</SelectItem>
            {regions.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={label} onValueChange={onLabelChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder={t('lands.allLabels')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('lands.allLabels')}</SelectItem>
            <SelectItem value="TFL">TFL</SelectItem>
            <SelectItem value="VEFL">VEFL</SelectItem>
            <SelectItem value="VEFIL">VEFIL</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t('lands.allStatuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('lands.allStatuses')}</SelectItem>
            <SelectItem value="AVAILABLE">{t('lands.status.AVAILABLE')}</SelectItem>
            <SelectItem value="RESERVED">{t('lands.status.RESERVED')}</SelectItem>
            <SelectItem value="SOLD">{t('lands.status.SOLD')}</SelectItem>
            <SelectItem value="ARCHIVED">{t('lands.status.ARCHIVED')}</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm text-muted-foreground">
          {lands.length} {t('lands.results')}
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
                  {t('table.label')}
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  {t('table.size')}
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  {t('table.price')}
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  {t('table.status')}
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  {t('table.published')}
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  {t('table.pv')}
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  {t('table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lands.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-sm text-muted-foreground">
                    {t('lands.noResults')}
                  </td>
                </tr>
              ) : (
                lands.map((land) => (
                  <tr key={land.id} className="transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                          {land.media[0] ? (
                            <Image
                              src={land.media[0].url}
                              alt={land.title}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground">
                              <LayoutGrid className="size-4" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-48 truncate font-medium text-foreground">
                            {land.title}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-3" />
                            {land.city ? `${land.city}, ` : ''}
                            {land.region}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
                            LABEL_STYLES[land.label.code] ??
                              'border-gray-200 bg-gray-100 text-gray-700',
                          )}
                        >
                          {land.label.code}
                        </span>
                        {land.isVerified && <ShieldCheck className="size-3.5 text-success" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {land.sizeM2.toLocaleString()} m²
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-primary-600">
                      {formatXAF(land.price)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant="outline"
                        className={cn('text-xs', LAND_STATUS_STYLES[land.status])}
                      >
                        {t(`lands.status.${land.status}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onTogglePublish(land)}
                        className={cn(
                          'inline-flex size-6 items-center justify-center rounded-full transition-colors',
                          land.isPublished
                            ? 'bg-success/10 text-success hover:bg-success/20'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200',
                        )}
                        title={land.isPublished ? t('lands.unpublish') : t('lands.publish')}
                      >
                        <CheckCircle2 className="size-3.5" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                        ×{land.pv.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="size-8 p-0">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(land)}>
                            <Pencil className="size-4" />
                            {t('lands.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onTogglePublish(land)}>
                            <Eye className="size-4" />
                            {land.isPublished ? t('lands.unpublish') : t('lands.publish')}
                          </DropdownMenuItem>
                          {land.status !== 'ARCHIVED' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => onArchive(land)}
                              >
                                <Archive className="size-4" />
                                {t('lands.archive')}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
}
