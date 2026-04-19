export const dynamic = 'force-dynamic';

import { Users, MapPin, Award } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/dashboard/shared/stat-card';

const NETWORK = [
  { name: 'Marie Kameni', region: 'Centre · Yaoundé', level: 'Expert', sales: 24, referrals: 3 },
  { name: 'Paul Eteme', region: 'Littoral · Douala', level: 'Senior', sales: 15, referrals: 2 },
  { name: 'Sophie Mbarga', region: 'Ouest · Bafoussam', level: 'Expert', sales: 20, referrals: 4 },
  { name: 'Alain Fotso', region: 'Sud · Kribi', level: 'Junior', sales: 5, referrals: 1 },
  { name: 'Claire Ngo', region: 'Adamaoua · Ngaoundéré', level: 'Junior', sales: 3, referrals: 0 },
  { name: 'Jean Dupont', region: 'Nord · Garoua', level: 'Senior', sales: 11, referrals: 2 },
];

const LEVEL_STYLES = {
  Junior: 'border-gray-200 text-gray-600',
  Senior: 'border-primary-200 text-primary-700',
  Expert: 'border-gold-300 text-gold-700 bg-gold-50',
};

export default async function AgentNetworkPage() {
  const t = await getTranslations('app.network');
  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
          <p className="text-sm text-gray-500">{t('pageSubtitle')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Agents dans mon réseau"
            value={6}
            icon={<Users className="size-4 text-primary-600" />}
            accent="text-primary-600"
          />
          <StatCard
            label="Régions couvertes"
            value={6}
            icon={<MapPin className="size-4 text-success" />}
            accent="text-success"
          />
          <StatCard
            label="Experts dans le réseau"
            value={2}
            icon={<Award className="size-4 text-gold-600" />}
            accent="text-gold-600"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NETWORK.map((agent) => (
            <div
              key={agent.name}
              className="rounded-2xl border border-border bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-sm font-bold text-primary-600">
                  {agent.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{agent.name}</p>
                  <p className="flex items-center gap-1 text-xs text-gray-400">
                    <MapPin className="size-3" /> {agent.region}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className={LEVEL_STYLES[agent.level as keyof typeof LEVEL_STYLES]}
                >
                  {agent.level}
                </Badge>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{agent.sales} ventes</p>
                  <p className="text-xs text-gray-400">{agent.referrals} filleul(s)</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
