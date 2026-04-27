'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import Eyebrow from '@/components/ui/eyebrow';
import { Badge } from '@/components/ui/badge';
import type { FC } from 'react';

const Hero: FC = () => {
  const t = useTranslations();

  return (
    <section className="relative overflow-hidden bg-accent text-white">
      {/* Subtle gold radial glow on the right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(circle at 78% 50%, rgba(240, 188, 49, 0.12), transparent 55%)',
        }}
      />
      <div className="relative container mx-auto px-4 pt-24 pb-28 sm:px-6 md:pt-32 md:pb-36 lg:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6 text-center lg:text-left">
            <Eyebrow tone="gold" className="lg:inline-flex">
              {t('hero.eyebrow')}
            </Eyebrow>

            <h1 className="font-serif text-5xl leading-[1.02] font-semibold tracking-[-0.02em] text-pretty text-white sm:text-6xl md:text-7xl">
              {t('hero.title1')}
              <br />
              <span className="font-medium text-gold-300 italic">{t('hero.title2Lead')}</span>{' '}
              <span className="text-white">{t('hero.title2Tail')}</span>
            </h1>

            <p className="max-w-xl text-lg leading-[1.65] text-pretty text-accent-200">
              {t('hero.subtitle')}
            </p>

            {/* CTAs */}
            <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row lg:justify-start">
              <Button asChild size="lg">
                <Link href="/contact">{t('hero.cta')}</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/methode">
                  {t('hero.cta2')} <ArrowRight />
                </Link>
              </Button>
            </div>

            {/* Trust strip — method certified on N points */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-white/10 pt-6 lg:justify-start">
              <span className="text-[11px] font-medium tracking-[0.1em] text-accent-300 uppercase">
                {t('hero.trust.label')}
              </span>
              <span className="font-serif text-xl font-semibold text-white">
                {t('hero.trust.points')}
              </span>
              <span className="text-accent-500">·</span>
              <span className="font-serif text-xl font-semibold text-white">
                {t('hero.trust.domains')}
              </span>
              <span className="text-accent-500">·</span>
              <span className="font-serif text-xl font-semibold text-white">
                {t('hero.trust.milestones')}
              </span>
            </div>
          </div>

          {/* Right column — labels showcase card */}
          <div className="relative px-4 sm:px-0">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm">
              <div className="space-y-6">
                <div>
                  <Eyebrow tone="gold">{t('hero.labels.eyebrow')}</Eyebrow>
                  <h3 className="mt-3 font-serif text-2xl leading-tight text-white">
                    {t('hero.labels.title')}
                  </h3>
                </div>

                <div className="space-y-3">
                  {(['tfl', 'vefl', 'vefil'] as const).map((label) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3"
                    >
                      <div>
                        <Badge variant={label}>KAMBRIQ {label.toUpperCase()}™</Badge>
                        <p className="mt-2 text-xs text-accent-200">
                          {t(`hero.labels.${label}.summary` as 'hero.labels.tfl.summary')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  href="/products/verify"
                  className="inline-flex items-center gap-2 text-sm font-medium text-gold-300 hover:text-gold-200"
                >
                  {t('hero.labels.cta')} <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
