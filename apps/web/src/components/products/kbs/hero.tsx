import { Award, GraduationCap } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import SharedHero from '@/components/hero';

const Hero = async () => {
  const t = await getTranslations('products.kbs.hero');
  return (
    <SharedHero
      Icon={GraduationCap}
      heroBadgeLabel={t('eyebrow')}
      title={t('title')}
      subtitle={t('subtitle')}
      cta1={{ label: t('applyNow'), href: '/contact' }}
      cta2={{ label: t('learnMore'), href: '/products/kamnet' }}
    >
      <div className="mt-5 flex w-full items-center justify-center">
        <div className="flex max-w-lg items-center justify-center rounded-md bg-primary-100 px-6 py-2.5 outline outline-primary-700 sm:px-3.5">
          <div className="flex items-center gap-x-4 text-sm/6 text-primary-700">
            <Award className="size-5" />
            {t('certificateBadge')}
          </div>
        </div>
      </div>
    </SharedHero>
  );
};

export default Hero;
