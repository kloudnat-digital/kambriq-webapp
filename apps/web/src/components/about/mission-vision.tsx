import { Target, Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';

export const MissionVision = () => {
  const t = useTranslations('about');
  return (
    <section className="px-6 py-20 sm:px-8">
      <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary-500/10">
            <Target className="size-6 text-primary-600" />
          </div>
          <h2 className="mb-3 text-xl font-semibold">{t('mission.title')}</h2>
          <p className="leading-relaxed text-gray-600">{t('mission.body')}</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-gold-500/10">
            <Eye className="size-6 text-gold-600" />
          </div>
          <h2 className="mb-3 text-xl font-semibold">{t('vision.title')}</h2>
          <p className="leading-relaxed text-gray-600">{t('vision.body')}</p>
        </div>
      </div>
    </section>
  );
};
