export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';

import { getMyAgentProfile, getMyNetwork, getMySponsors } from '@/lib/actions/kamnet';
import { NetworkContent } from './network-content';
import { NetworkEmpty } from './network-empty';

/**
 * Renders the authenticated agent's network tree.
 *
 * The depth of the tree is the API's decision, by the caller's own tier (I32):
 * the page asks for the network and renders what comes back. Only the MANAGER
 * tier is shown network statistics.
 *
 * Server-fetched translations are passed down as strings to synchronous children.
 */

export async function generateMetadata() {
  const t = await getTranslations('app.network');
  return { title: t('pageTitle') };
}

export default async function AgentNetworkPage() {
  const t = await getTranslations('app.network');

  const profileRes = await getMyAgentProfile();
  const profile = profileRes.success ? profileRes.data : null;

  const tier = profile?.tier ?? 'JUNIOR';

  const [networkRes, sponsorsRes] = await Promise.all([getMyNetwork(), getMySponsors()]);
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
