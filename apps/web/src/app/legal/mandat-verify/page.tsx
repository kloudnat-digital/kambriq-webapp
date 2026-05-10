import { getLocale } from 'next-intl/server';

import { loadContent } from '@/lib/content';

export const metadata = {
  title: 'Mandat KAMBRIQ VERIFY™ | KAMBRIQ',
  description:
    'Mandat type pour la prestation de vérification foncière KAMBRIQ VERIFY™ - droits et obligations des parties.',
};

export default async function MandatVerifyPage() {
  const locale = await getLocale();
  const Content = await loadContent('legal-mandat-verify', locale);
  return <Content />;
}
