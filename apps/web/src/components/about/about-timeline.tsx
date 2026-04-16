import { useTranslations } from 'next-intl';

const MILESTONES = [
  { year: '2019', color: 'bg-primary-500' },
  { year: '2022', color: 'bg-gold-500' },
  { year: '2025', color: 'bg-accent-500' },
];

export const AboutTimeline = () => {
  const t = useTranslations('about.timeline');
  return (
    <section className="bg-gray-50 px-6 py-20 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-12 text-center text-2xl font-bold">{t('title')}</h2>
        <ol className="relative border-l border-gray-200">
          {MILESTONES.map((m, i) => (
            <li key={m.year} className="mb-10 ml-6 last:mb-0">
              <span
                className={`absolute -left-3 flex size-6 items-center justify-center rounded-full ring-4 ring-white ${m.color}`}
              />
              <p className="mb-1 text-sm font-medium text-gray-500">{m.year}</p>
              <h3 className="text-base font-semibold text-gray-900">{t(`items.${i}.title`)}</h3>
              <p className="mt-1 text-sm text-gray-600">{t(`items.${i}.description`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
