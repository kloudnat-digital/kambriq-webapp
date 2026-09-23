import { Award, Layers, Users } from 'lucide-react';

import { NetworkNodeCard } from './network-node';
import type { NetworkNode, SponsorChain } from '@/types/kamnet';

/**
 * Renders the network tree and computed statistics.
 *
 * Statistics are calculated recursively from the returned network tree data.
 * The statistics panel is restricted to `MANAGER` tier agents, as lower tiers
 * (JUNIOR, CONFIRMED) only have visibility into their direct (N1) referrals,
 * making aggregate statistics redundant.
 *
 * Note: To ensure compatibility with test environments, this component is
 * fully synchronous and receives localized labels as props instead of using async
 * translation fetching directly.
 */

export interface NetworkLabels {
  statAgents: string;
  statPlaces: string;
  statManagers: string;
  sponsorChain: string;
  tier: (tier: string) => string;
  level: (level: number) => string;
}

const flatten = (nodes: NetworkNode[]): NetworkNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.referrals)]);

export const NetworkContent = ({
  root,
  sponsors,
  showStatistics,
  labels,
}: {
  root: NetworkNode;
  sponsors: SponsorChain | null;
  showStatistics: boolean;
  labels: NetworkLabels;
}) => {
  const everyone = flatten(root.referrals);
  const places = new Set(
    everyone.map((n) => n.agent.user.city ?? n.agent.user.country).filter(Boolean),
  );
  const managers = everyone.filter((n) => n.agent.tier === 'MANAGER').length;

  return (
    <div className="space-y-8">
      {showStatistics && (
        <div data-network-stats className="grid gap-4 sm:grid-cols-3">
          <StatTile
            label={labels.statAgents}
            value={everyone.length}
            icon={<Users className="size-4 text-primary-600" />}
          />
          <StatTile
            label={labels.statPlaces}
            value={places.size}
            icon={<Layers className="size-4 text-success" />}
          />
          <StatTile
            label={labels.statManagers}
            value={managers}
            icon={<Award className="size-4 text-gold-600" />}
          />
        </div>
      )}

      {sponsors && sponsors.chain.length > 0 && (
        <section className="rounded-2xl border border-border bg-muted p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">{labels.sponsorChain}</h2>
          <ol className="space-y-1">
            {sponsors.chain.map((link) => (
              <li key={link.id} className="text-sm text-muted-foreground">
                <span className="font-mono text-xs">{link.agentCode}</span>
                {link.name ? ` - ${link.name}` : ''} ({labels.level(link.level)})
              </li>
            ))}
          </ol>
        </section>
      )}

      <div data-network="tree" className="space-y-4">
        {root.referrals.map((child) => (
          <NetworkNodeCard
            key={child.agent.id}
            node={child}
            level={1}
            tierLabel={labels.tier}
            levelLabel={labels.level}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Internal stat tile component.
 * Implements a localized semantic token-based design to avoid
 * dependencies on external UI components and hardcoded non-system color classes.
 */
const StatTile = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
    <div className="mb-3 flex items-center justify-between">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex size-9 items-center justify-center rounded-xl bg-muted">{icon}</div>
    </div>
    <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
  </div>
);
