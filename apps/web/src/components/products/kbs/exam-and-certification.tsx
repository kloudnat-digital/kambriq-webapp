import React from 'react';
import SectionHeader from '@/components/section/header';
import { CheckIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

const ExamAndCertification = async () => {
  const t = await getTranslations('products.kbs.exam');
  const chapters = [
    {
      id: 'exam-format',
      titleKey: 'formatTitle',
      items: ['format1', 'format2', 'format3'] as const,
    },
    {
      id: 'after-certification',
      titleKey: 'afterTitle',
      items: ['after1', 'after2', 'after3'] as const,
    },
  ] as const;
  return (
    <div className="container mx-auto px-4 py-5 sm:px-6 lg:px-8">
      <SectionHeader
        titleClassName="text-4xl sm:text-5xl"
        title={t('title')}
        subtitle={t('subtitle')}
      />

      <div className="mx-auto mt-10 grid max-w-md grid-cols-1 gap-5 lg:max-w-4xl lg:grid-cols-2">
        {chapters.map((chapter) => (
          <div
            key={chapter.id}
            className="flex flex-col justify-between rounded-lg bg-gold-50 p-5 shadow-xs outline outline-gold-700 sm:p-6"
          >
            <div>
              <p className="text-3xl font-semibold tracking-tight text-gold-900">
                {t(chapter.titleKey)}
              </p>
              <ul className="mt-8 space-y-4 text-sm/6 text-gold-800">
                {chapter.items.map((itemKey) => (
                  <li key={itemKey} className="flex gap-x-3">
                    <CheckIcon aria-hidden="true" className="h-6 w-5 flex-none text-gold-600" />
                    {t(itemKey)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExamAndCertification;
