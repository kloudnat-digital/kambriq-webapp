import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import SectionHeader from '@/components/section/header';
import Eyebrow from '@/components/ui/eyebrow';

const ProductsServices = async () => {
  const t = await getTranslations('products');

  const products = [
    { key: 'lands', href: '/products/lands', accent: 'gold' as const },
    { key: 'verify', href: '/products/verify', accent: 'teal' as const },
    { key: 'kamnet', href: '/products/kamnet', accent: 'navy' as const },
    { key: 'kbs', href: '/products/kbs', accent: 'gold' as const },
  ];

  const accentBorder: Record<'gold' | 'teal' | 'navy', string> = {
    gold: 'var(--color-gold)',
    teal: 'var(--color-primary)',
    navy: 'var(--color-accent)',
  };

  return (
    <section className="bg-white py-24 md:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow={t('sectionEyebrow')}
          title={t('title')}
          subtitle={t('subtitle')}
          align="left"
          className="mx-auto max-w-3xl text-left"
        />

        <div className="mx-auto mt-14 grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map(({ key, href, accent }) => (
            <Link
              key={key}
              href={href}
              className="group relative flex flex-col rounded-xl border border-border bg-white p-6 transition-shadow hover:shadow-hover"
              style={{ borderTop: `2px solid ${accentBorder[accent]}` }}
            >
              <Eyebrow tone={accent === 'gold' ? 'gold' : 'teal'}>
                {t(`${key}.badge` as 'lands.badge')}
              </Eyebrow>
              <h3 className="mt-3 font-serif text-2xl leading-[1.15] font-semibold text-accent">
                {t(`${key}.title` as 'lands.title')}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-surface-600">
                {t(`${key}.description` as 'lands.description')}
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary group-hover:gap-2">
                {t(`${key}.cta` as 'lands.cta')}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProductsServices;
