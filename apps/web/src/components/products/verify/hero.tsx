import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

const Hero = async () => {
  const t = await getTranslations('products.verify.hero');
  const tc = await getTranslations('products.verify.heroCard');

  return (
    <section className="mx-auto max-w-7xl pt-14 pb-16">
      <div className="py-8 sm:py-12 lg:grid lg:grid-cols-12 lg:gap-8 lg:py-14">
        <div className="px-6 sm:text-center md:mx-auto md:max-w-2xl lg:col-span-6 lg:flex lg:items-center lg:text-left">
          <div>
            <div className="hidden sm:mb-4 sm:flex sm:justify-center lg:justify-start">
              <Badge className="rounded-full bg-primary-100 px-3 py-1 text-primary-600 ring-1 ring-primary-700/50">
                <ShieldCheck className="mr-1 size-3 flex-none" />
                <span>{t('eyebrow')}</span>
              </Badge>
            </div>
            <h1 className="gray-900 text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
              {t('title')}
            </h1>
            <p className="mt-3 text-lg text-gray-500 sm:mt-5 sm:text-xl/8">{t('subtitle')}</p>
            <div className="mt-5 w-full sm:mx-auto sm:max-w-lg lg:ml-0">
              <div className="flex flex-wrap items-start gap-4">
                <Button asChild size="lg" className="h-9">
                  <Link href="/contact">{t('cta')}</Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="lg"
                  className="h-9 font-semibold text-gray-900 hover:bg-transparent hover:text-gray-900"
                >
                  <Link href="/methode">
                    {t('cta2')}
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-16 sm:mt-24 lg:col-span-6 lg:mt-0">
          <div className="bg-white outline outline-gray-200 sm:mx-auto sm:w-full sm:max-w-md sm:overflow-hidden sm:rounded-md">
            <div className="px-6 py-8 sm:px-10">
              <div className="flex gap-x-4 border-b border-gray-900/5 pb-6">
                <div className="relative pl-12">
                  <div className="text-base/7 font-medium text-gray-900">
                    <div className="absolute top-1 left-0 flex size-8 items-center justify-center rounded-md bg-primary-100">
                      <ShieldCheck className="size-5 text-primary-500" />
                    </div>
                    {tc('tfLabel')}
                  </div>
                  <div className="font-mono text-sm/7 text-gray-600">{tc('tfExample')}</div>
                </div>
                <div className="ml-auto flex items-start">
                  <Badge className="bg-primary-100 text-primary-600 outline-1 outline-primary-700/50">
                    {tc('verified')}
                  </Badge>
                </div>
              </div>
              <div className="divide-y divide-gray-100 text-sm/6">
                <div className="flex justify-between gap-x-4 py-3">
                  <p className="text-gray-700">{tc('authenticity')}</p>
                  <p className="font-medium text-gray-900">{tc('authenticityResult')}</p>
                </div>
                <div className="flex justify-between gap-x-4 py-3">
                  <p className="text-gray-700">{tc('ownerIdentity')}</p>
                  <p className="font-medium text-gray-900">{tc('ownerIdentityResult')}</p>
                </div>
                <div className="flex justify-between gap-x-4 py-3">
                  <p className="text-gray-700">{tc('legalStatus')}</p>
                  <p className="font-medium text-gray-900">{tc('legalStatusResult')}</p>
                </div>
                <div className="flex justify-between gap-x-4 py-3">
                  <p className="text-gray-700">{tc('conflicts')}</p>
                  <p className="font-medium text-gray-900">{tc('conflictsResult')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
