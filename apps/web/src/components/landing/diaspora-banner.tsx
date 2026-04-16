'use client';

import { useTranslations } from 'next-intl';
import type { FC } from 'react';

const DiasporaBanner: FC = () => {
  const t = useTranslations('diaspora');

  const stats = [
    { value: t('transactions.value'), desc: t('transactions.description') },
    { value: t('satisfaction.value'), desc: t('satisfaction.description') },
    { value: t('averageResponse.value'), desc: t('averageResponse.description') },
  ];

  return (
    <section className="bg-primary py-24 text-primary-foreground sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:max-w-none">
          <div className="text-center">
            <h2 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              {t('title')}
            </h2>
            <p className="mx-auto mt-4 max-w-175 text-lg/8">{t('subtitle')}</p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-0.5 overflow-hidden text-center sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.value} className="flex flex-col">
                <div className="text-sm/6 font-semibold capitalize">{stat.desc}</div>
                <div className="order-first text-3xl font-semibold tracking-tight">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DiasporaBanner;
