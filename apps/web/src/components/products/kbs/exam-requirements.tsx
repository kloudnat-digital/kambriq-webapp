import React from 'react';
import { CheckIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

/**
 * Maps to translation keys item1, item2, item3.
 * These are rendered dynamically, requiring the keys in ITEM_KEYS to precisely
 * match those provided in the localization file.
 */
const ITEM_KEYS = ['item1', 'item2', 'item3'] as const;

const ExamRequirements = async () => {
  const t = await getTranslations('products.kbs.requirements');
  return (
    <div className="container mx-auto grid max-w-md grid-cols-1 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between rounded-lg bg-gold-50 p-5 shadow-xs outline outline-gold-700 sm:p-6">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-gold-900">{t('title')}</p>
          <p className="mt-2 text-base/7 text-gold-700">{t('description')}</p>
          <ul className="mt-8 space-y-4 text-sm/6 text-gold-800">
            {ITEM_KEYS.map((key) => (
              <li key={key} className="flex gap-x-3">
                <CheckIcon aria-hidden="true" className="h-6 w-5 flex-none text-gold-600" />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ExamRequirements;
