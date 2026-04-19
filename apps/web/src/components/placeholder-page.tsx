import { Construction } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';

type PlaceholderPageProps = {
  titleKey: string;
  subtitleKey: string;
  namespace: string;
  features: string[];
  roles: string[];
};

export async function PlaceholderPage({
  titleKey,
  subtitleKey,
  namespace,
  features,
  roles,
}: PlaceholderPageProps) {
  const t = await getTranslations(namespace);
  const tApp = await getTranslations('app');

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t(titleKey)}</h1>
        <p className="mt-1 text-sm text-gray-500">{t(subtitleKey)}</p>
      </div>

      <div className="mx-auto max-w-lg rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
        <Construction className="mx-auto size-12 text-gray-400" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">{tApp('underConstruction')}</h2>
        <p className="mt-2 text-sm text-gray-500">{tApp('underConstructionDesc')}</p>

        {features.length > 0 && (
          <div className="mt-6 text-left">
            <h3 className="text-sm font-medium text-gray-700">{tApp('features')}</h3>
            <ul className="mt-2 space-y-1">
              {features.map((feature) => (
                <li key={feature} className="text-sm text-gray-500">
                  &bull; {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        {roles.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-medium text-gray-700">{tApp('authorizedRoles')}</h3>
            <div className="flex flex-wrap justify-center gap-2">
              {roles.map((role) => (
                <Badge key={role} variant="secondary">
                  {role}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
