import { Network } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import SharedHero from '@/components/hero';

const Hero = async () => {
  const t = await getTranslations('products.kamnet.hero');
  return (
    <SharedHero
      Icon={Network}
      heroBadgeLabel={t('eyebrow')}
      title={t('title')}
      subtitle={t('subtitle')}
      cta1={{ label: t('cta'), href: '/kamnet/apply' }}
      cta2={{ label: t('cta2'), href: '/contact' }}
    />
  );
};

export default Hero;
