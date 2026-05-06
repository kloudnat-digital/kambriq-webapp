'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  MapPin,
  Ruler,
  Banknote,
  FileCheck,
  Droplets,
  Zap,
  Tag,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatXAF } from '@/lib/money';
import { LAND_LABEL_CODE_STYLES } from '@/components/products/lands/admin/constants';
import type { MockLand } from '@/data/mock-lands';

type Props = { lands: MockLand[] };

const BoolCell = ({ value }: { value?: boolean }) =>
  value ? (
    <span className="inline-flex items-center gap-1 text-sm text-success">
      <ShieldCheck className="size-4" /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-sm text-gray-400">
      <ShieldOff className="size-4" /> No
    </span>
  );

export const CompareTable = ({ lands }: Props) => {
  const t = useTranslations('landsCompare');

  const rows = [
    { key: 'image', label: t('attrs.image'), icon: null },
    { key: 'location', label: t('attrs.location'), icon: MapPin },
    { key: 'surface', label: t('attrs.surface'), icon: Ruler },
    { key: 'price', label: t('attrs.price'), icon: Banknote },
    { key: 'pricePerM2', label: t('attrs.pricePerM2'), icon: Banknote },
    { key: 'label', label: t('attrs.label'), icon: Tag },
    { key: 'tfNumber', label: t('attrs.tfNumber'), icon: FileCheck },
    { key: 'verified', label: t('attrs.verified'), icon: ShieldCheck },
    { key: 'water', label: t('attrs.water'), icon: Droplets },
    { key: 'electricity', label: t('attrs.electricity'), icon: Zap },
    { key: 'topography', label: t('attrs.topography'), icon: null },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-48 font-semibold text-gray-700">{t('attribute')}</TableHead>
            {lands.map((land) => (
              <TableHead
                key={land.id}
                className="min-w-[240px] text-center font-semibold text-gray-700"
              >
                {land.title}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key} className="hover:bg-muted/20">
              <TableCell className="bg-muted/10 font-medium text-gray-600">
                <span className="flex items-center gap-2">
                  {row.icon && <row.icon className="size-4 text-muted-foreground" />}
                  {row.label}
                </span>
              </TableCell>
              {lands.map((land) => (
                <TableCell key={land.id} className="text-center">
                  {row.key === 'image' && land.media[0] && (
                    <div className="relative mx-auto h-32 w-full overflow-hidden rounded-lg">
                      <Image
                        src={land.media[0].url}
                        alt={land.title}
                        fill
                        className="object-cover"
                        sizes="240px"
                      />
                    </div>
                  )}
                  {row.key === 'location' && (
                    <span className="text-sm">
                      {land.city}, {land.region}
                    </span>
                  )}
                  {row.key === 'surface' && (
                    <span className="text-sm font-medium">{land.sizeM2.toLocaleString()} m²</span>
                  )}
                  {row.key === 'price' && (
                    <span className="text-base font-semibold text-primary-600">
                      {formatXAF(land.price)}
                    </span>
                  )}
                  {row.key === 'pricePerM2' && (
                    <span className="text-sm text-gray-500">
                      {formatXAF(Math.round(land.price / land.sizeM2))}/m²
                    </span>
                  )}
                  {row.key === 'label' && (
                    <Badge
                      className={
                        LAND_LABEL_CODE_STYLES[
                          land.label.code as keyof typeof LAND_LABEL_CODE_STYLES
                        ]
                      }
                    >
                      {land.label.code}
                    </Badge>
                  )}
                  {row.key === 'tfNumber' && (
                    <span className="font-mono text-xs">{land.tfNumber ?? '-'}</span>
                  )}
                  {row.key === 'verified' && <BoolCell value={land.isVerified} />}
                  {row.key === 'water' && <BoolCell value={land.waterAccess} />}
                  {row.key === 'electricity' && <BoolCell value={land.electricityAccess} />}
                  {row.key === 'topography' && (
                    <span className="text-sm capitalize">{land.topography ?? '-'}</span>
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {/* Actions row */}
          <TableRow className="bg-muted/10">
            <TableCell className="font-medium text-gray-600">{t('actions')}</TableCell>
            {lands.map((land) => (
              <TableCell key={land.id} className="text-center">
                <div className="flex flex-col gap-2">
                  {land.tfNumber && (
                    <Button asChild size="sm" className="w-full">
                      <Link href={`/products/verify?tf=${land.tfNumber}`}>{t('verifyLand')}</Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href="/contact">{t('contact')}</Link>
                  </Button>
                </div>
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};
