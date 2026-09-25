export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';

import { KAMNET_MAX_SPONSORSHIP_DEPTH } from '@kambriq/common/constants/kamnet';
import { getMyAgentProfile, getMyNetwork, getMySponsors } from '@/lib/actions/kamnet';
import { NetworkContent } from './network-content';
import { NetworkEmpty } from './network-empty';

/**
 * Renders the authenticated agent's network tree.
 *
 * Implements depth rules per UX specification section 2.3 and P9:
 * - Depth is restricted to N1 for all tiers (JUNIOR, CONFIRMED, MANAGER).
 * - MANAGER tier is the only tier authorized to view network statistics.
 *
 * Note on security constraint I32: Tier-based depth limits are currently
 * enforced by this client. The GET /kamnet/network endpoint reads the `depth`
 * query parameter without independently asserting tier authorization.
 *
 * Server-fetched translations are passed down as strings to synchronous children.
 */

/**
 * Maps agent tiers to authorized network depth.
 *
 * Uses `KAMNET_MAX_SPONSORSHIP_DEPTH` for MANAGER to prevent drift
 * between the client constraint and platform constants.
 * Currently, all tiers resolve to depth 1.
 */
const DEPTH_FOR_TIER: Record<string, number> = {
  JUNIOR: 1,
  CONFIRMED: 1,
  MANAGER: KAMNET_MAX_SPONSORSHIP_DEPTH,
};

export async function generateMetadata() {
  const t = await getTranslations('app.network');
  return { title: t('pageTitle') };
}

export default async function AgentNetworkPage() {
  const t = await getTranslations('app.network');

  const profileRes = await getMyAgentProfile();
  const profile = profileRes.success ? profileRes.data : null;

  const tier = profile?.tier ?? 'JUNIOR';
  const depth = DEPTH_FOR_TIER[tier] ?? 1;

  const [networkRes, sponsorsRes] = await Promise.all([getMyNetwork(depth), getMySponsors()]);
  const root = networkRes.success ? networkRes.data : null;
  const sponsors = sponsorsRes.success ? sponsorsRes.data : null;

  const hasReferrals = Boolean(root && root.referrals.length > 0);

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('pageSubtitle')}</p>
        </div>

        {hasReferrals && root ? (
          <NetworkContent
            root={root}
            sponsors={sponsors}
            showStatistics={tier === 'MANAGER'}
            labels={{
              statAgents: t('statAgents'),
              statPlaces: t('statPlaces'),
              statManagers: t('statManagers'),
              sponsorChain: t('sponsorChain'),
              tier: (value: string) => t(`tier.${value}` as never),
              level: (value: number) => t('level', { level: value }),
            }}
          />
        ) : (
          <NetworkEmpty title={t('emptyTitle')} message={t('emptyMessage')} />
        )}
      </div>
    </div>
  );
}
