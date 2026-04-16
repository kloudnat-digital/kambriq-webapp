import { MapPin, Network, Building2, ArrowRight, Blocks, Signature } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import SectionHeader from '@/components/section/header';

const ProductsServices = async () => {
  const t = await getTranslations('products');

  const products = [
    {
      Icon: MapPin,
      key: 'lands',
      href: '/products/lands',
      available: true,
    },
    {
      Icon: Signature,
      key: 'verify',
      href: '/products/verify',
      available: true,
    },
    {
      Icon: Network,
      key: 'kamnet',
      href: '/products/kamnet',
      available: true,
    },
    {
      Icon: Building2,
      key: 'kbs',
      href: '/products/kbs',
      available: true,
    },
    {
      Icon: Blocks,
      key: 'kcpi',
      href: '#',
      available: false,
    },
  ];

  return (
    <section className="bg-muted/30 py-20 md:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title={t('title')} subtitle={t('subtitle')} />

        <div className="mx-auto mt-16 grid max-w-7xl gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
          {products.map(({ Icon, key, href, available }) => (
            <div
              key={key}
              className={cn(
                'group relative rounded-lg border border-border bg-white p-6 sm:rounded-3xl sm:p-8',
              )}
            >
              <div
                className={cn(
                  'mb-6 flex size-16 items-center justify-center rounded-lg',
                  available
                    ? 'bg-primary/10 text-primary'
                    : 'bg-secondary text-secondary-foreground',
                )}
              >
                <Icon className={cn('h-8 w-8 transition-transform duration-300')} />
              </div>

              <h3 className="mb-3 text-2xl font-medium text-foreground">
                {t(`${key}.title` as 'lands.title')}
              </h3>
              <p className="mb-6 leading-relaxed text-gray-600">
                {t(`${key}.description` as 'lands.description')}
              </p>

              {available ? (
                <Button
                  asChild
                  variant="ghost"
                  className="group/btn -ml-4 text-primary hover:bg-primary/5 hover:text-primary"
                >
                  <Link href={href} className="flex items-center gap-2">
                    {t(`${key}.cta` as 'lands.cta')}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                  </Link>
                </Button>
              ) : (
                <Badge variant={'secondary'} className="py-3">
                  {t('comingSoon')}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProductsServices;
