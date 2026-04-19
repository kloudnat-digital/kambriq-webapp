import SectionHeader from '@/components/section/header';
import { CheckIcon } from 'lucide-react';
import React from 'react';
import { getTranslations } from 'next-intl/server';

const CHAPTER_KEYS = ['chapter1', 'chapter2', 'chapter3', 'chapter4'] as const;
const ITEM_KEYS = ['item1', 'item2', 'item3', 'item4'] as const;

const WhatYouWillLearn = async () => {
  const t = await getTranslations('products.kbs.whatYouLearn');
  return (
    <section className="border-t border-border/45 py-20 md:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title={t('title')} subtitle={t('subtitle')} />

        <div className="mx-auto mt-10 grid max-w-md grid-cols-1 gap-8 lg:max-w-5xl lg:grid-cols-2">
          {CHAPTER_KEYS.map((chKey) => (
            <div
              key={chKey}
              className="flex flex-col justify-between rounded-lg bg-white p-8 shadow-xs outline outline-gray-900/10 sm:p-10"
            >
              <div>
                <h3 className="text-base/7 font-semibold text-primary-500">{t(`${chKey}.name`)}</h3>
                <div className="mt-4">
                  <p className="text-3xl font-semibold tracking-tight text-gray-900">
                    {t(`${chKey}.title`)}
                  </p>
                </div>
                <p className="mt-2 text-base/7 text-gray-600">{t(`${chKey}.description`)}</p>
                <ul className="mt-10 space-y-4 text-sm/6 text-gray-600">
                  {ITEM_KEYS.map((itemKey) => (
                    <li key={itemKey} className="flex gap-x-3">
                      <CheckIcon
                        aria-hidden="true"
                        className="h-6 w-5 flex-none text-primary-400"
                      />
                      {t(`${chKey}.${itemKey}`)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhatYouWillLearn;
