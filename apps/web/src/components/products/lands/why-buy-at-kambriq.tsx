import { getTranslations } from 'next-intl/server';
import React from 'react';
import SectionHeader from '../../section/header';
import SectionCardContainer from '../../section/card/container';
import SectionCard from '../../section/card';
import { ArrowRight, ClipboardClock, CreditCard, Scale, ShieldUser } from 'lucide-react';
import { Button } from '../../ui/button';
import Link from 'next/link';

const WhyBuyAtKambriq = async () => {
  const t = await getTranslations('whyBuyAtKambriq');

  const features = [
    { Icon: Scale, title: t('legalSecurity.title'), description: t('legalSecurity.description') },
    { Icon: CreditCard, title: t('payment.title'), description: t('payment.description') },
    {
      Icon: ClipboardClock,
      title: t('transparency.title'),
      description: t('transparency.description'),
    },
    { Icon: ShieldUser, title: t('kamnetAgent.title'), description: t('kamnetAgent.description') },
  ] as const;

  return (
    <section className="border-t border-border/45 bg-white py-20 md:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title={t('title')} subtitle={t('subtitle')} />
        <SectionCardContainer>
          {features.map(({ Icon, title, description }) => (
            <SectionCard key={title} Icon={Icon} title={title} description={description} />
          ))}
        </SectionCardContainer>

        <div className="mx-auto mt-10 flex items-center justify-center gap-x-6">
          <Button asChild size="lg" className="h-9">
            <Link href="/products/kamnet">{t('cta')}</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="lg"
            className="h-9 font-semibold text-gray-900 hover:bg-transparent hover:text-gray-900"
          >
            <Link href="/products/verify">
              {t('cta2')}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default WhyBuyAtKambriq;
