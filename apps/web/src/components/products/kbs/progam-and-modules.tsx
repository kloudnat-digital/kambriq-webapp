import SectionHeader from '@/components/section/header';
import { AppWindow, Clock, LibraryBig } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import KBSModules from './modules';
import ExamAndCertification from './exam-and-certification';
import ExamRequirements from './exam-requirements';

const FEATURE_ICONS = [Clock, AppWindow, LibraryBig] as const;

type Feature = { name: string; title: string; description: string };

const ProgramAndModules = async () => {
  const t = await getTranslations('products.kbs.program');
  const features = t.raw('features') as Feature[];

  return (
    <section className="border-t border-border/45 bg-background py-20 md:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title={t('title')} subtitle={t('subtitle')} />
        <div className="mx-auto mt-20 max-w-4xl text-center">
          <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => {
              const Icon = FEATURE_ICONS[i] ?? Clock;
              return (
                <div key={feature.name} className="pt-6">
                  <div className="flow-root rounded-lg bg-gold-50 px-6 pb-8 outline outline-gold-700">
                    <div className="-mt-6">
                      <div className="relative">
                        <span className="inline-flex items-center justify-center rounded-xl bg-gold-500 p-3 shadow-md">
                          <Icon aria-hidden="true" className="size-8 text-gold-800" />
                        </span>
                      </div>
                      <h3 className="mt-4 text-2xl/8 font-semibold tracking-tight text-gold-900">
                        {feature.name}
                      </h3>
                      <p className="mt-4 text-xl/7 font-medium text-gold-800">{feature.title}</p>
                      <p className="mt-2 text-base/7 font-medium text-gold-700">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <KBSModules />
        <ExamAndCertification />
        <ExamRequirements />
      </div>
    </section>
  );
};

export default ProgramAndModules;
