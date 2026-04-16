import Link from 'next/link';
import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

export const KamnetHero = () => {
  const t = useTranslations('products.kamnet.hero');
  return (
    <section className="bg-gradient-to-br from-gold-900 via-gold-800 to-amber-800 px-6 py-24 text-white sm:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-3xl bg-white/10">
          <Users className="size-10" />
        </div>
        <p className="mb-4 text-sm font-medium tracking-widest text-amber-300 uppercase">
          {t('eyebrow')}
        </p>
        <h1 className="mb-6 text-4xl font-bold sm:text-5xl">{t('title')}</h1>
        <p className="mb-8 text-lg text-amber-100">{t('subtitle')}</p>
        <Button asChild size="lg" className="bg-white text-amber-900 hover:bg-amber-50">
          <Link href="/kamnet/apply">{t('cta')}</Link>
        </Button>
      </div>
    </section>
  );
};
