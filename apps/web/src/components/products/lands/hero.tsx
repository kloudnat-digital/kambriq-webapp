import { BadgeCheck, ShieldCheck, ScanSearch } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import SharedHero from '@/components/hero';

const Hero = async () => {
  const t = await getTranslations('landsHero');
  return (
    <SharedHero
      Icon={ShieldCheck}
      heroBadgeLabel={t('badge')}
      title={t('title')}
      subtitle={t('subtitle')}
      cta1={{ label: t('cta'), href: '/contact' }}
      cta2={{ label: t('cta2'), href: '/products/verify' }}
      indicators={[
        { icon: BadgeCheck, label: t('indicator1') },
        { icon: ScanSearch, label: t('indicator2') },
        { icon: ShieldCheck, label: t('indicator3') },
      ]}
    />
  );
};

export default Hero;
