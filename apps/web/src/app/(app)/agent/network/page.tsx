export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';

import { getMyAgentProfile, getMyNetwork, getMySponsors } from '@/lib/actions/kamnet';
import { NetworkContent } from './network-content';
import { NetworkEmpty } from './network-empty';

/**
 * `/agent/network`, served from the API.
 *
 * What this page used to be is worth recording, because it is why the tests
 * around it are mostly negative. It declared a module-level constant of six
 * agents who do not exist, with invented sales and referral counts, three
 * hard-coded statistics, and a badge map keyed on "Expert" and "Senior" -
 * tiers this system does not have. It rendered all of it. A placeholder is
 * honest; this looked finished, and it was the screen an agent would open
 * first.
 *
 * The depth requested follows the agent's tier, from UX specification section
 * 2.3: JUNIOR and CONFIRMED see N1, MANAGER sees N1 to N3 plus statistics.
 *
 * One thing this page cannot do, said plainly rather than implied: the tier rule
 * is applied HERE, and GET /kamnet/network does not enforce it. The service
 * reads `depth` from the query and never looks at the caller's tier, so a
 * JUNIOR asking for depth 3 receives N1 to N3 from the API today. This is a
 * presentation rule, not a boundary, and closing it belongs on the server.
 *
 * Translations are fetched once here and passed down as plain strings. The
 * children are synchronous for that reason - see `network-empty.tsx`.
 */

const DEPTH_FOR_TIER: Record<string, number> = {
  JUNIOR: 1,
  CONFIRMED: 1,
  MANAGER: 3,
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
