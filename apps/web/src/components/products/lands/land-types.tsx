import { cn } from '@/lib/utils';
import { CheckIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import SectionHeader from '../../section/header';

const LAND_TYPE_THEMES = {
  primary: {
    ring: 'ring-primary-500',
    badge: 'bg-primary-500/10 text-primary-600',
    heading: 'text-primary-600',
    icon: 'text-primary-600',
  },
  accent: {
    ring: 'ring-accent-800',
    badge: 'bg-accent-800/10 text-accent-600',
    heading: 'text-accent-600',
    icon: 'text-accent-600',
  },
  gold: {
    ring: 'ring-gold-500',
    badge: 'bg-gold-800/10 text-gold-600',
    heading: 'text-gold-600',
    icon: 'text-gold-600',
  },
} as const;

const LAND_TYPES = [
  {
    code: 'TFL™' as const,
    colorScheme: 'primary' as const,
    nameKey: 'tfl.name' as const,
    descriptionKey: 'tfl.description' as const,
    features: [
      { labelKey: 'clientAdvantages' as const, detailKey: 'tfl.advantages.client' as const },
      { labelKey: 'kambriqCommitment' as const, detailKey: 'tfl.advantages.commitment' as const },
    ],
  },
  {
    code: 'VEFL™' as const,
    colorScheme: 'gold' as const,
    nameKey: 'vefl.name' as const,
    descriptionKey: 'vefl.description' as const,
    features: [
      { labelKey: 'clientAdvantages' as const, detailKey: 'vefl.advantages.client' as const },
      { labelKey: 'kambriqCommitment' as const, detailKey: 'vefl.advantages.commitment' as const },
    ],
  },
  {
    code: 'VEFIL™' as const,
    colorScheme: 'accent' as const,
    nameKey: 'vefil.name' as const,
    descriptionKey: 'vefil.description' as const,
    features: [
      { labelKey: 'clientAdvantages' as const, detailKey: 'vefil.advantages.client' as const },
      { labelKey: 'kambriqCommitment' as const, detailKey: 'vefil.advantages.commitment' as const },
    ],
  },
] as const;

const LandTypes = async () => {
  const t = await getTranslations('landTypes');

  return (
    <div className="group/lands border-t border-border/45 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader title={t('title')} subtitle={t('subtitle')} />
        <div className="isolate mx-auto mt-10 grid max-w-md grid-cols-1 gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {LAND_TYPES.map((type) => {
            const theme = LAND_TYPE_THEMES[type.colorScheme];
            return (
              <div
                key={type.code}
                className={cn('group/type rounded-3xl p-8 ring-2 xl:p-10', theme.ring)}
              >
                <div className="flex flex-col gap-y-4">
                  <p
                    className={cn(
                      'max-w-max rounded-full px-2.5 py-1 text-xs/5 font-semibold uppercase',
                      theme.badge,
                    )}
                  >
                    {type.code}
                  </p>
                  <h3 className={cn('text-lg/8 font-semibold', theme.heading)}>
                    {t(type.nameKey)}
                  </h3>
                </div>
                <p className="mt-4 text-sm/6 text-gray-600">{t(type.descriptionKey)}</p>
                <ul className="mt-8 space-y-3 text-sm/6 text-gray-600 xl:mt-10">
                  {type.features.map((feature) => (
                    <li key={feature.labelKey} className="flex gap-x-3">
                      <div className="relative">
                        <div>
                          <div className="absolute flex items-center justify-center">
                            <CheckIcon className={cn('size-6', theme.icon)} />
                          </div>
                          <p className="ml-8 text-base/6 font-medium text-gray-900">
                            {t(feature.labelKey)}
                          </p>
                        </div>
                        <p className="mt-2 ml-8">{t(feature.detailKey)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LandTypes;
