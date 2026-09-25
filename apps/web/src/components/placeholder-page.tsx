import { Construction } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

/**
 * A signed-in screen that is not built yet (I43).
 *
 * It names itself and says it is not built - nothing else. It used to take a
 * `features` list, hardcoded French, and render it as "Fonctionnalités
 * prévues": 38 promises across ten screens, none of them built, read by the
 * agents we were recruiting. A list of what a screen will do is a promise, so
 * this component no longer accepts one, nor a subtitle describing the screen,
 * nor the roles allowed on it. `placeholder-page.spec.tsx` pins the whole text.
 */
type PlaceholderPageProps = {
  namespace: string;
  titleKey: string;
};

export async function PlaceholderPage({ namespace, titleKey }: PlaceholderPageProps) {
  const t = await getTranslations(namespace);
  const tApp = await getTranslations('app');

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t(titleKey)}</h1>
      </div>

      <div className="mx-auto max-w-lg rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
        <Construction className="mx-auto size-12 text-gray-400" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">{tApp('notBuilt.title')}</h2>
        <p className="mt-2 text-sm text-gray-500">{tApp('notBuilt.description')}</p>
      </div>
    </div>
  );
}
