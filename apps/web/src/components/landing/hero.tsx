'use client';

import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import Autoplay from 'embla-carousel-autoplay';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import type { FC } from 'react';
import { useMemo } from 'react';

const HERO_SLIDES = [
  {
    id: '1',
    src: 'https://images.unsplash.com/photo-1764719396639-66ea940bb757?q=80&w=2670&auto=format&fit=crop',
    alt: 'Vue aérienne de terrain au Cameroun',
  },
  {
    id: '2',
    src: 'https://images.unsplash.com/photo-1764223531702-1614efb82e40?q=80&w=3732&auto=format&fit=crop',
    alt: 'Vue cadastrale de parcelles au Cameroun',
  },
];

const Hero: FC = () => {
  const t = useTranslations();

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const carouselPlugins = useMemo(
    () => (prefersReducedMotion ? [] : [Autoplay({ delay: 4000 })]),
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

            <div className="flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
              <Button asChild size="lg" className="h-9">
                <Link href="/methode">{t('hero.cta')}</Link>
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
          </div>

          <div className="relative px-4 sm:px-0">
            <Carousel className="w-full" opts={{ loop: true }} plugins={carouselPlugins}>
              <CarouselContent>
                {HERO_SLIDES.map((slide, index) => (
                  <CarouselItem key={slide.id}>
                    <div className="aspect-square overflow-hidden rounded-md border border-border shadow-(--shadow-card)">
                      <div className="relative h-full w-full">
                        <Image
                          fill
                          className="object-cover"
                          src={slide.src}
                          priority={index === 0}
                          alt={slide.alt}
                          sizes="(max-width: 1024px) 100vw, 50vw"
                        />
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
