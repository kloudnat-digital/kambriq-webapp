'use client';

import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { MapPin, Ruler, Banknote, FileCheck, Droplets, Zap, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatXAF } from '@/lib/money';
import { LAND_LABEL_CODE_STYLES } from '@/components/products/lands/admin/constants';
import type { MockLand } from '@/data/mock-lands';

type Props = { lands: MockLand[] };

const StatRow = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-start gap-3">
    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
      <Icon className="size-4 text-muted-foreground" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{value}</div>
    </div>
  </div>
);

export const CompareCards = ({ lands }: Props) => {
  const t = useTranslations('landsCompare');

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {lands.map((land) => (
        <Card key={land.id} className="overflow-hidden">
          {land.media[0] && (
            <div className="relative h-44 w-full">
              <Image
                src={land.media[0].url}
                alt={land.title}
                fill
                className="object-cover"
                sizes="400px"
              />
              <div className="absolute top-3 left-3">
                <Badge
                  className={
                    LAND_LABEL_CODE_STYLES[land.label.code as keyof typeof LAND_LABEL_CODE_STYLES]
                  }
                >
                  {land.label.code}
                </Badge>
              </div>
              {land.isVerified && (
                <div className="absolute top-3 right-3">
                  <Badge className="border-success/30 bg-success/10 text-success">
                    <ShieldCheck className="size-3" /> Vérifié
                  </Badge>
                </div>
              )}
            </div>
          )}
          <CardContent className="space-y-4 p-5">
            <h3 className="line-clamp-2 text-base font-semibold text-gray-900">{land.title}</h3>
            <div className="space-y-3">
              <StatRow
                icon={MapPin}
                label={t('attrs.location')}
                value={`${land.city}, ${land.region}`}
              />
              <StatRow
                icon={Ruler}
                label={t('attrs.surface')}
                value={`${land.sizeM2.toLocaleString()} m²`}
              />
              <StatRow
                icon={Banknote}
                label={t('attrs.price')}
                value={
                  <span className="text-primary-600">
                    {formatXAF(land.price)}
                    <span className="ml-1 text-xs font-normal text-gray-400">
                      ({formatXAF(Math.round(land.price / land.sizeM2))}/m²)
                    </span>
                  </span>
                }
              />
              {land.tfNumber && (
                <StatRow
                  icon={FileCheck}
                  label={t('attrs.tfNumber')}
                  value={<span className="font-mono text-xs">{land.tfNumber}</span>}
                />
              )}
              <div className="flex gap-4 pt-1">
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Droplets className="size-3.5" />
                  {land.waterAccess ? t('yes') : t('no')}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Zap className="size-3.5" />
                  {land.electricityAccess ? t('yes') : t('no')}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              {land.tfNumber && (
                <Button asChild size="sm" className="w-full">
                  <Link href={`/products/verify?tf=${land.tfNumber}`}>{t('verifyLand')}</Link>
                </Button>
              )}
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/contact">{t('contact')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
