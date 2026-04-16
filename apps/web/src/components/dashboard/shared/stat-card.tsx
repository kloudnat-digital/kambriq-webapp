import { cn } from '@/lib/utils';

type StatCardProps = {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  icon?: React.ReactNode;
};

export const StatCard = ({ label, value, sub, accent, icon }: StatCardProps) => (
  <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
    <div className="mb-3 flex items-center justify-between">
      <p className="text-sm text-gray-500">{label}</p>
      {icon && (
        <div className="flex size-9 items-center justify-center rounded-xl bg-gray-50">{icon}</div>
      )}
    </div>
    <p className={cn('text-2xl font-bold tracking-tight', accent ?? 'text-gray-900')}>{value}</p>
    {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
  </div>
);
