import { ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Eyebrow from '@/components/ui/eyebrow';

const Hero = async () => {
  const t = await getTranslations('products.verify.hero');
  const tc = await getTranslations('products.verify.heroCard');

  return (
    <section className="bg-surface-100">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left — copy */}
          <div className="text-center lg:text-left">
            <Eyebrow className="lg:inline-flex">{t('eyebrow')}</Eyebrow>
            <h1 className="mt-4 font-serif text-4xl leading-[1.05] font-semibold tracking-[-0.02em] text-pretty text-accent sm:text-5xl md:text-6xl">
              {t('title')}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-[1.65] text-surface-600">{t('subtitle')}</p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
              <Button asChild size="lg">
                <Link href="/contact">{t('cta')}</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/methode">
                  {t('cta2')}
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>

          {/* Right — sample report card */}
          <div className="rounded-xl border border-border bg-white shadow-card">
            <div className="border-b border-border px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md bg-primary-50">
                    <ShieldCheck className="size-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-accent">{tc('tfLabel')}</div>
                    <div className="font-mono text-xs text-surface-500">TF-12345-ABCD</div>
                  </div>
                </div>
                <Badge variant="tfl">{tc('verified')}</Badge>
              </div>
            </div>
            <div className="divide-y divide-border px-6 text-sm">
              {(
                [
                  ['authenticity', 'authenticityResult'],
                  ['ownerIdentity', 'ownerIdentityResult'],
                  ['legalStatus', 'legalStatusResult'],
                  ['conflicts', 'conflictsResult'],
                ] as const
              ).map(([labelKey, resultKey]) => (
                <div key={labelKey} className="flex justify-between gap-4 py-3">
                  <p className="text-surface-600">{tc(labelKey)}</p>
                  <p className="font-medium text-accent">{tc(resultKey)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
