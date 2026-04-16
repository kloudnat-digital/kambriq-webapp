'use client';

import { ArrowRight, BadgeCheck, CalendarCheck, ScanSearch } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import Autoplay from 'embla-carousel-autoplay';
import { formatXAF } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import type { FC } from 'react';
import { useMemo } from 'react';
import { Badge } from '../ui/badge';
import { MOCK_LANDS } from '@/data/mock-lands';

const Hero: FC = () => {
  const t = useTranslations();
  const locale = useLocale();

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const carouselPlugins = useMemo(
    () => (prefersReducedMotion ? [] : [Autoplay({ delay: 3000 })]),
    [prefersReducedMotion],
  );

  return (
    <section className="relative overflow-hidden bg-white pt-24 pb-24 md:pt-32 md:pb-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="space-y-8 text-center lg:text-left">
            <div className="space-y-4">
              <h1 className="font-sans text-5xl font-semibold tracking-tight text-pretty text-surface-950 sm:text-7xl">
                {t('hero.title1')} <span className="text-primary">{t('hero.title2')}</span>
              </h1>
              <p className="text-lg font-medium text-pretty text-gray-500 sm:text-xl/8">
                {t('hero.subtitle')}
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
              <Button asChild size="lg" className="h-9">
                <Link href="/products/lands">{t('hero.cta')}</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="h-9 font-semibold text-gray-900 hover:bg-transparent hover:text-gray-900"
              >
                <Link href="/products/verify">
                  {t('hero.cta2')} <ArrowRight />
                </Link>
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 font-sans text-base/7 font-medium text-gray-900 lg:justify-start">
              {[
                { label: t('hero.since2019'), icon: CalendarCheck },
                { label: t('hero.certifiedPartners'), icon: BadgeCheck },
                { label: t('hero.cadastralVerification'), icon: ScanSearch },
              ].map(({ label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-success" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative px-4 sm:px-0">
            <Carousel className="w-full" opts={{ loop: true }} plugins={carouselPlugins}>
              <CarouselContent>
                {MOCK_LANDS.map((slide) => (
                  <CarouselItem key={slide.id}>
                    <div className="aspect-square overflow-hidden rounded-md border border-border shadow-(--shadow-card)">
                      <div className="relative h-full w-full">
                        <Image
                          fill
                          className="object-cover"
                          src={slide.media[0].url}
                          priority={slide.id === '1'}
                          alt={`${slide.title} · ${slide.neighborhood}, ${slide.city}`}
                          sizes="(max-width: 1024px) 100vw, 50vw"
                        />
                        {/* Overlay with land info */}
                        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
                        <div className="absolute right-0 bottom-0 left-0 p-5 text-white">
                          <Badge
                            variant={'secondary'}
                            className="mb-2 bg-white/20 text-white backdrop-blur-sm"
                          >
                            {slide.label.code}
                          </Badge>
                          <p className="text-base font-semibold">
                            {slide.title} · {slide.sizeM2.toLocaleString(locale)} m²
                          </p>
                          <p className="text-sm text-white/80">
                            {slide.neighborhood}, {slide.city} - {formatXAF(slide.price, locale)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
