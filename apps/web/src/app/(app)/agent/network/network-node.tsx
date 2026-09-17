import { MapPin } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { NetworkNode as NetworkNodeType } from '@/types/kamnet';

/**
 * One agent in the tree, and its referrals beneath it.
 *
 * `data-level` carries the depth this node sits at, so a test can assert the
 * shape of the tree rather than count cards. The previous version of this
 * screen had no notion of level at all: it rendered a flat grid of six invented
 * agents with a made-up "Expert" / "Senior" / "Junior" badge that matched no
 * enum in the system. The real tiers are JUNIOR, CONFIRMED and MANAGER, and
 * they come from the server.
 *
 * Every colour here is a token. The previous version used `gray-200`,
 * `gray-400`, `gray-600`, `gray-900` and `bg-white`, and styled its badge from
 * a hand-written `LEVEL_STYLES` map keyed on strings that do not exist.
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
