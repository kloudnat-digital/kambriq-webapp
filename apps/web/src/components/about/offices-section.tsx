import { MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getTranslations } from 'next-intl/server';

const OFFICES = [
  { city: 'Yaoundé', country: 'Cameroun', active: true },
  { city: 'Douala', country: 'Cameroun', active: true },
  { city: 'Paris', country: 'France', active: false },
  { city: 'Montreal', country: 'Canada', active: false },
];

export const OfficesSection = async () => {
  const t = await getTranslations('about.offices');
  return (
    <section className="bg-gray-50 px-6 py-20 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-12 text-center text-2xl font-bold">{t('title')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OFFICES.map((office) => (
            <div
              key={`${office.city}-${office.country}`}
              className="flex items-start gap-3 rounded-xl border border-border bg-white p-5"
            >
              <MapPin className="mt-0.5 size-5 shrink-0 text-primary-500" />
              <div>
                <p className="font-semibold text-gray-900">{office.city}</p>
                <p className="text-sm text-gray-500">{office.country}</p>
                <Badge
                  variant="outline"
                  className={`mt-2 text-xs ${office.active ? 'border-success/30 bg-success/10 text-success' : 'border-gray-200 text-gray-400'}`}
                >
                  {office.active ? t('active') : t('comingSoon')}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
