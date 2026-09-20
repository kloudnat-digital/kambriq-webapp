export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';

import { KAMNET_MAX_SPONSORSHIP_DEPTH } from '@kambriq/common/constants/kamnet';
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
 * 2.3: JUNIOR and CONFIRMED see N1, MANAGER saw N1 to N3 plus statistics.
 * P9 (20 September 2026) ended sponsorship at the direct sponsor, so every tier
 * now resolves to N1 and only the statistics half of that rule still separates
 * a MANAGER from the others.
 *
 * One thing this page cannot do, said plainly rather than implied: the tier rule
 * is applied HERE, and GET /kamnet/network does not enforce it. The service
 * reads `depth` from the query and never looks at the caller's tier. That is
 * I32, it is still open, and P9 did not close it - it only shrank what the gap
 * can expose, because everyone is clamped to N1 anyway. A narrowed blast radius
 * is not a fix, and the day the depth rises the hole is the size it always was.
 *
 * Translations are fetched once here and passed down as plain strings. The
 * children are synchronous for that reason - see `network-empty.tsx`.
 */

/**
 * The depth each tier asks the API for.
 *
 * MANAGER reads the constant rather than a literal. It was `3`, and when P9
 * moved `KAMNET_MAX_SPONSORSHIP_DEPTH` to 1 that literal did not move with it:
 * the page went on asking for a depth the action silently clamped, so the page
 * and the server disagreed and nothing reported it. Expressed this way they
 * cannot drift apart again.
 *
 * The map is kept rather than collapsed because "how deep may a tier see" is a
 * product rule that has already changed once; today every entry resolves to 1.
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
