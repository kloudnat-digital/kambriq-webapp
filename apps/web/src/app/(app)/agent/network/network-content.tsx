import { Award, Layers, Users } from 'lucide-react';

import { NetworkNodeCard } from './network-node';
import type { NetworkNode, SponsorChain } from '@/types/kamnet';

/**
 * The tree, and - for a MANAGER only - the statistics over it.
 *
 * The statistics are COMPUTED from the tree that was returned, never declared.
 * The previous version of this screen hard-coded `value={6}` for "agents in my
 * network", `6` for regions and `2` for experts, against six agents that did
 * not exist. Numbers that do not come from the data are the same defect as the
 * agents, one step further along.
 *
 * Why only a MANAGER sees them: UX specification section 2.3, verbatim -
 * "Junior : filleuls N1 uniquement. Confirme : filleuls N1. Manager : filleuls
 * N1+N2+N3 + stats reseau globales." A JUNIOR and a CONFIRMED see N1 and no
 * aggregate, because an aggregate over one level is the count of cards already
 * on screen.
 *
 * P9 (20 September 2026) SUPERSEDES the depth half of that quotation: every
 * tier now sees N1, because sponsorship stops at the direct sponsor. The quote
 * is left as written rather than edited - it is a citation of a specification,
 * and rewriting it would misrepresent what that document says. The statistics
 * half still holds: only a MANAGER sees the aggregate.
 *
 * Synchronous, taking its labels as props. See the note in `network-empty.tsx`:
 * an async child cannot be resolved when the parent's output is rendered
 * directly, which silently emptied the DOM in tests while the browser was fine.
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
 * A local tile rather than the shared `StatCard`.
 *
 * `StatCard` carries five non-system colour classes of its own (`gray-500`,
 * `gray-50`, `gray-900`, `gray-400`, `white`) and is also used by
 * `/admin/verify`. Editing it would fix this screen's rendered output and
 * silently change another one outside this PR; reusing it would leave this
 * screen emitting `gray-*` after the page file itself was cleaned. So the tile
 * is local and tokenised, and `StatCard`'s five are reported as a finding with
 * their consumers named rather than quietly half-fixed.
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
