'use client';

import Image from 'next/image';
import {
  MapPin,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Ruler,
  Droplets,
  Zap,
  HelpCircle,
} from 'lucide-react';
import type { useTranslations } from 'next-intl';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { formatXAF } from '@/lib/money';
import type { MockLand } from '@/data/mock-lands';
import { LABEL_STYLES, DOCS, type SubDialog } from './constants';

type ModalBodyProps = {
  land: MockLand;
  t: ReturnType<typeof useTranslations<'landSearch'>>;
  onSubDialog: (d: SubDialog) => void;
};

export function ModalBody({ land, t, onSubDialog }: ModalBodyProps) {
  const pricePerSqm = Math.round(land.price / land.sizeM2);

  return (
    <>
      <div className="flex flex-col">
        {/* Carousel */}
        <Carousel className="w-full">
          <CarouselContent>
            {land.media.map((img, i) => (
              <CarouselItem key={i}>
                <div className="relative aspect-video overflow-hidden">
                  <Image
                    src={img.url}
                    alt={`${land.title} — photo ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="768px"
                    priority={i === 0}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {land.media.length > 1 && (
            <>
              <CarouselPrevious className="left-3" />
              <CarouselNext className="right-3" />
            </>
          )}
        </Carousel>

        <div className="flex flex-col gap-4 p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{land.title}</h2>
              <div className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                <MapPin className="size-3.5 shrink-0" />
                <span>
                  {land.neighborhood}, {land.city} — {land.region}
                </span>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'shrink-0',
                land.status === 'reserved'
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-success/30 bg-success/10 text-success',
              )}
            >
              {land.status === 'reserved' ? t('modal.statusReserved') : t('modal.statusAvailable')}
            </Badge>
          </div>

          {/* Badges row */}
          <div className="flex flex-wrap gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                LABEL_STYLES[land.label.code] ?? 'border-gray-200 bg-gray-100 text-gray-700',
              )}
            >
              {land.label.code}
            </span>
            {land.isVerified && (
              <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
                <ShieldCheck className="size-3" />
                {t('verified')}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              <Ruler className="size-3" />
              {land.sizeM2.toLocaleString()} m²
            </span>
            {land.tfNumber && (
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 font-mono text-xs text-gray-600">
                {land.tfNumber}
              </span>
            )}
          </div>

          {/* Price section */}
          <div className="rounded-xl border border-primary-500/20 bg-gradient-to-br from-primary-500/10 to-primary-500/5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs text-gray-500">{t('modal.totalPrice')}</p>
                <p className="mt-1 text-3xl font-bold text-primary-600">{formatXAF(land.price)}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {t('modal.pricePerSqm', { price: pricePerSqm.toLocaleString('fr-FR') })}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-medium text-success">{t('modal.instalments')}</p>
                <p className="mt-0.5 text-xs text-gray-500">{t('modal.deposit')}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="identity" className="flex-col">
            <TabsList
              variant="line"
              className="h-auto w-full justify-start gap-0 rounded-none border-b border-border pb-0"
            >
              {(['identity', 'verification', 'technical', 'description', 'actions'] as const).map(
                (id) => (
                  <TabsTrigger key={id} value={id} className="rounded-none px-4 pb-3 text-sm">
                    {t(`modal.tabs.${id}` as 'modal.tabs.identity')}
                  </TabsTrigger>
                ),
              )}
            </TabsList>

            <TabsContent value="identity" className="mt-4">
              <IdentityTab land={land} t={t} />
            </TabsContent>

            <TabsContent value="verification" className="mt-4 space-y-4">
              <VerificationTab land={land} t={t} />
            </TabsContent>

            <TabsContent value="technical" className="mt-4 space-y-4">
              <TechnicalTab land={land} t={t} />
            </TabsContent>

            <TabsContent value="description" className="mt-4">
              <DescriptionTab land={land} t={t} />
            </TabsContent>

            <TabsContent value="actions" className="mt-4">
              <ActionsTab t={t} onSubDialog={onSubDialog} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}

type TabProps = {
  land: MockLand;
  t: ReturnType<typeof useTranslations<'landSearch'>>;
};

function IdentityTab({ land, t }: TabProps) {
  const rows: [string, string][] = [
    [t('modal.details.type'), land.label.name],
    [t('modal.details.size'), `${land.sizeM2.toLocaleString()} m²`],
    [t('modal.details.price'), formatXAF(land.price)],
    [t('modal.details.region'), land.region],
    [t('modal.details.city'), land.city],
    [t('modal.details.neighborhood'), land.neighborhood],
    ...(land.tfNumber
      ? ([[t('modal.details.tfNumber'), land.tfNumber]] as [string, string][])
      : []),
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="mt-1 text-sm font-medium break-all text-gray-900">{value}</p>
        </div>
      ))}
    </div>
  );
}

function VerificationTab({ land, t }: TabProps) {
  return (
    <>
      <div
        className={cn(
          'flex items-start gap-3 rounded-xl border p-4',
          land.isVerified ? 'border-success/20 bg-success/5' : 'border-gray-200 bg-gray-50',
        )}
      >
        <ShieldCheck
          className={cn(
            'mt-0.5 size-5 shrink-0',
            land.isVerified ? 'text-success' : 'text-gray-400',
          )}
        />
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {land.isVerified
              ? t('modal.verification.verified')
              : t('modal.verification.notVerified')}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {land.isVerified
              ? t('modal.verification.verifiedDesc')
              : t('modal.verification.notVerifiedDesc')}
          </p>
          {land.verifiedAt && (
            <p className="mt-2 text-xs text-gray-400">
              {t('modal.verification.verifiedAt', {
                date: new Date(land.verifiedAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }),
              })}
            </p>
          )}
        </div>
      </div>
      <Separator />
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">{t('modal.verification.docsTitle')}</p>
        {DOCS.map((key) => (
          <Button key={key} variant="outline" size="sm" className="w-full justify-start gap-2">
            <FileText className="size-4 text-primary-600" />
            {t(key)}
          </Button>
        ))}
      </div>
      <div className="space-y-2 pt-1">
        {(['check1', 'check2', 'check3'] as const).map((key) => (
          <div key={key} className="flex items-center gap-2 text-sm text-gray-700">
            <CheckCircle2
              className={cn('size-4 shrink-0', land.isVerified ? 'text-success' : 'text-gray-300')}
            />
            {t(`modal.verification.${key}`)}
          </div>
        ))}
      </div>
    </>
  );
}

function TechnicalTab({ land, t }: TabProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {land.topography && (
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">{t('modal.technical.topography')}</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{land.topography}</p>
          </div>
        )}
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">{t('modal.technical.water')}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <Droplets
              className={cn('size-4', land.waterAccess ? 'text-success' : 'text-gray-300')}
            />
            <span
              className={cn(
                'text-sm font-medium',
                land.waterAccess ? 'text-success' : 'text-gray-400',
              )}
            >
              {land.waterAccess ? t('modal.technical.available') : t('modal.technical.unavailable')}
            </span>
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">{t('modal.technical.electricity')}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <Zap
              className={cn('size-4', land.electricityAccess ? 'text-success' : 'text-gray-300')}
            />
            <span
              className={cn(
                'text-sm font-medium',
                land.electricityAccess ? 'text-success' : 'text-gray-400',
              )}
            >
              {land.electricityAccess
                ? t('modal.technical.available')
                : t('modal.technical.unavailable')}
            </span>
          </div>
        </div>
      </div>
      {land.features && land.features.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">
              {t('modal.technical.features')}
            </p>
            <div className="flex flex-wrap gap-2">
              {land.features.map((f) => (
                <Badge key={f} variant="secondary">
                  {f}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function DescriptionTab({ land, t }: TabProps) {
  return land.description ? (
    <p className="text-sm leading-relaxed text-gray-600">{land.description}</p>
  ) : (
    <p className="text-sm text-gray-400 italic">{t('modal.noDescription')}</p>
  );
}

function ActionsTab({
  t,
  onSubDialog,
}: {
  t: ReturnType<typeof useTranslations<'landSearch'>>;
  onSubDialog: (d: SubDialog) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <p className="mb-1 text-sm font-semibold text-gray-900">{t('modal.actions.title')}</p>
      <p className="mb-4 text-xs text-gray-500">{t('modal.actions.description')}</p>
      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => onSubDialog('prospect')}
        >
          <HelpCircle className="size-4" />
          {t('modal.actions.createProspect')}
        </Button>
        <Button className="w-full justify-start gap-2" onClick={() => onSubDialog('reservation')}>
          <CheckCircle2 className="size-4" />
          {t('modal.actions.reserve')}
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => onSubDialog('docs')}
        >
          <FileText className="size-4" />
          {t('modal.actions.viewDocs')}
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => onSubDialog('support')}
        >
          <ShieldCheck className="size-4" />
          {t('modal.actions.requestSupport')}
        </Button>
      </div>
    </div>
  );
}
