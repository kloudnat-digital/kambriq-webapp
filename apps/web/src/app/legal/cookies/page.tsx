import { getLocale } from 'next-intl/server';

import { loadContent } from '@/lib/content';

export const metadata = {
  title: 'Politique cookies | KAMBRIQ',
  description:
    'Politique de gestion des cookies et traceurs sur dev.kambriq.com - finalités, durées et choix de l’utilisateur.',
};

export default async function CookiesPage() {
  const locale = await getLocale();
  const Content = await loadContent('legal-cookies', locale);
  return <Content />;
}
