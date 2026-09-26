import { MapPin } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { NetworkNode as NetworkNodeType } from '@/types/kamnet';

/**
 * Renders an agent node and their referrals in the network tree.
 *
 * Exposes `data-level` to allow tests to assert structural depth.
 * Applies strictly token-based colors to enforce design system compliance.
 * Agent tiers (JUNIOR, CONFIRMED, MANAGER) are driven by the API response.
 */

const TIER_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  MANAGER: 'default',
  CONFIRMED: 'secondary',
  JUNIOR: 'outline',
};

export const NetworkNodeCard = ({
  node,
  level,
  tierLabel,
  levelLabel,
}: {
  node: NetworkNodeType;
  level: number;
  tierLabel: (tier: string) => string;
  levelLabel: (level: number) => string;
}) => {
  const { agent, referrals } = node;
  const name = [agent.user.firstName, agent.user.lastName].filter(Boolean).join(' ');
  const place = [agent.user.city, agent.user.country].filter(Boolean).join(', ');
  const initial = (agent.user.firstName ?? agent.agentCode).charAt(0);

  return (
    <div data-level={String(level)} className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-sm font-bold text-primary-600">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {name || agent.agentCode}
            </p>
            {place && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" /> {place}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant={TIER_VARIANT[agent.tier] ?? 'outline'}>{tierLabel(agent.tier)}</Badge>
            <Badge variant="ghost">{levelLabel(level)}</Badge>
          </div>
          <p className="font-mono text-xs text-muted-foreground">{agent.agentCode}</p>
        </div>
      </div>

      {referrals.length > 0 && (
        <div className="space-y-3 border-l border-border pl-4">
          {referrals.map((child) => (
            <NetworkNodeCard
              key={child.agent.id}
              node={child}
              level={level + 1}
              tierLabel={tierLabel}
              levelLabel={levelLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
};
