'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { LandDetailMedia } from '@/types/lands';

interface LandGalleryProps {
  media: LandDetailMedia[];
  title: string;
}

export const LandGallery = ({ media, title }: LandGalleryProps) => {
  const t = useTranslations('app.landDetail');
  const [activeImg, setActiveImg] = useState(0);
  const cover = media[activeImg] ?? null;

  return (
    <div className="overflow-hidden rounded-md border border-gray-200 bg-gray-100">
      <div className="relative h-64 sm:h-80">
        {cover ? (
          <Image
            fill
            src={cover.downloadUrl}
            alt={title}
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 66vw, 50vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            {t('noPhoto')}
          </div>
        )}
      </div>
      {media.length > 1 && (
        <div className="flex gap-2 overflow-x-auto p-3">
          {media.map((m, i) => (
            <button
              key={i}
              onClick={() => setActiveImg(i)}
              className={cn(
                'relative h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 transition-colors',
                activeImg === i ? 'border-primary' : 'border-transparent',
              )}
            >
              <Image src={m.downloadUrl} alt="" fill className="object-cover" sizes="80px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
