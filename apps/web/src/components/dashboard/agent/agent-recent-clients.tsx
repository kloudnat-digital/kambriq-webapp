import { Badge } from '@/components/ui/badge';

type Client = {
  name: string;
  land: string;
  status: 'in_progress' | 'reserved' | 'completed';
  date: string;
};

const MOCK: Client[] = [
  { name: 'Alphonse Biya', land: 'Terrain Bastos', status: 'reserved', date: '10 jan 2025' },
  { name: 'Sandra Njoh', land: 'Terrain Kribi', status: 'completed', date: '05 jan 2025' },
  { name: 'Roland Fouda', land: 'Terrain Dibamba', status: 'in_progress', date: '18 jan 2025' },
  { name: 'Cécile Mbarga', land: 'Terrain Bafoussam', status: 'in_progress', date: '20 jan 2025' },
];

const STATUS_STYLES = {
  in_progress: 'border-amber-300 bg-amber-50 text-amber-700',
  reserved: 'border-blue-300 bg-blue-50 text-blue-700',
  completed: 'border-success/30 bg-success/10 text-success',
};
const STATUS_LABELS = { in_progress: 'En cours', reserved: 'Réservé', completed: 'Vendu' };

export const AgentRecentClients = () => (
  <div className="rounded-2xl border border-border bg-white shadow-sm">
    <div className="border-b border-border px-6 py-4">
      <h3 className="font-semibold text-gray-900">Clients récents</h3>
    </div>
    <div className="divide-y divide-border">
      {MOCK.map((c) => (
        <div key={c.name} className="flex items-center justify-between px-6 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900">{c.name}</p>
            <p className="text-xs text-gray-500">
              {c.land} · {c.date}
            </p>
          </div>
          <Badge className={STATUS_STYLES[c.status]}>{STATUS_LABELS[c.status]}</Badge>
        </div>
      ))}
    </div>
  </div>
);
