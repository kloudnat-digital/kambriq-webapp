import { getTranslations } from 'next-intl/server';

import SectionHeader from '@/components/section/header';

/**
 * P10 - what the agent hands the buyer: the rubriques of a selection dossier,
 * taken from the land file template (sections 1 to 7). Headings only - no
 * value, no parcel, no example: no parcel is ever visible on a public page.
 * Sections 8 (the partner's declarations) and 9 (KAMBRIQ internal use) never
 * appear, nor does the owner's identity document behind "verified legal owner".
 */
type Rubrique = { title: string; detail?: string };

const SelectionDossier = async () => {
  const t = await getTranslations('landsDossier');
  const items = t.raw('items') as Rubrique[];

  return (
    <section
      data-testid="lands-selection-dossier"
      className="border-t border-border/45 bg-background py-20 md:py-28"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title={t('title')} subtitle={t('subtitle')} />
        <ol className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
          {items.map((item, index) => (
            <li key={item.title} className="flex gap-x-4 rounded-2xl p-6 ring-1 ring-border">
              <span className="text-sm font-semibold text-primary-600">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <p className="font-medium text-gray-900">{item.title}</p>
                {item.detail ? <p className="mt-1 text-sm/6 text-gray-600">{item.detail}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default SelectionDossier;
