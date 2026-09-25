import { ShieldQuestion, UserRound } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { getMyAgentProfile } from '@/lib/actions/kamnet';
import { PublicListingControl } from './public-listing-control';

/**
 * Consent is read on every request. A cached "listed" served after a
 * withdrawal would be the page contradicting the promise the control makes.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('app.agentProfile');
  return { title: t('pageTitle') };
}

/**
 * `/agent/profile` - P11's home for the agent's directory consent.
 *
 * ---------------------------------------------------------------------------
 * Why this route exists at all
 * ---------------------------------------------------------------------------
 * The subject asked for the control "on their profile screen", and there was no
 * profile screen: `(app)/profile` and `(app)/agent/dashboard` are both
 * `PlaceholderPage` - an "under construction" card listing features that do not
 * exist. Bolting a live switch onto one of those would put a working control
 * inside a page that announces itself as unbuilt, which is worse than either.
 * Visquis chose a minimal real screen carrying only the consent control, on
 * 22 September; the rest of an agent's profile remains its own subject.
 *
 * No routing change was needed. `/agent` is already in `PROTECTED_PREFIXES` and
 * in `ROLE_GATES` as `[AGENT, ADMIN_GLOBAL]`, so the middleware guards this the
 * moment the file exists, and `middleware-matcher.spec.ts` walks `src/app` and
 * checks exactly that rather than trusting a remembered list.
 *
 * ---------------------------------------------------------------------------
 * The empty state is also the failure state, deliberately
 * ---------------------------------------------------------------------------
 * `getMyAgentProfile` answers `null` for "the caller has no KAMNET agent
 * record", which is the ordinary state for everybody who is not an agent, and
 * the page says so in words rather than rendering a control that would 404 on
 * use.
 *
 * **A failed read is NOT that state**, and the first version of this page said
 * it was. Both branches rendered "Vous n'etes pas agent KAMNET", so a real
 * agent opening this screen while the API was down was told they were not an
 * agent - a false statement about them, made by us, at the moment we could not
 * check. Visquis caught it on 22 September.
 *
 * So there are three states, not two. The action `nullOn404`s a 404 and
 * RETHROWS everything else, and `createAction` rethrows anything that is not a
 * `ServerActionError`, so a 500 or an unreachable API arrives here as a
 * rejected promise rather than a failure envelope. That is why the call is
 * wrapped in `.catch(() => null)` - the shape `/verify-certificate` uses for
 * the same reason - and why both "it threw" and "it answered `success: false`"
 * mean unavailable.
 *
 * The consent control renders in neither failure branch. A control that cannot
 * read the current consent cannot honestly offer to change it.
 *
 * Translations are fetched once here and the control takes its own, because it
 * is a client component and `next-intl`'s provider is already in the layout.
 */
export default async function AgentProfilePage() {
  const t = await getTranslations('app.agentProfile');

  // `null` here means the read threw - a 500, an unreachable API, anything the
  // action did not turn into a 404. It is not the same as an answer of `null`.
  const res = await getMyAgentProfile().catch(() => null);

  const unavailable = res === null || !res.success;
  const profile = res?.success ? res.data : null;

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
        </div>

        {unavailable ? (
          <ProfileUnavailable title={t('unavailableTitle')} message={t('unavailableMessage')} />
        ) : profile ? (
          <PublicListingControl
            listedSince={profile.publicListingConsentAt}
            suspended={profile.suspendedAt !== null}
          />
        ) : (
          <NotAnAgent title={t('emptyTitle')} message={t('emptyMessage')} />
        )}
      </div>
    </div>
  );
}

/**
 * Synchronous, and it takes its strings as props.
 *
 * `network-empty.tsx` carries the reason: an async child cannot be resolved by
 * React when a parent's output is rendered directly in a test, so an async
 * version leaves its `data-` node out of the DOM while the page looks correct
 * in a browser.
 */
const NotAnAgent = ({ title, message }: { title: string; message: string }) => (
  <div
    data-agent-profile="empty"
    className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-20 text-center"
  >
    <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-primary-500/10">
      <UserRound className="size-10 text-primary-500" />
    </div>
    <h2 className="mb-3 text-xl font-semibold text-foreground">{title}</h2>
    <p className="max-w-md px-6 text-sm text-muted-foreground">{message}</p>
  </div>
);

/**
 * We could not read the profile, and this says only that.
 *
 * Deliberately not `NotAnAgent` with different words: the two are different
 * claims about the reader. One says "you are not an agent", which is a
 * statement about them; this says "we cannot check", which is a statement about
 * us. Rendering the first when the second is true is what Visquis caught, and
 * the grey seal rather than the primary one is part of saying so - nothing here
 * is a finding about the person.
 *
 * "Rien n'a changé" is in the copy because the reader's likely next thought is
 * that their listing has been dropped. It has not: the register was simply not
 * readable at this moment.
 */
const ProfileUnavailable = ({ title, message }: { title: string; message: string }) => (
  <div
    data-agent-profile="unavailable"
    className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-20 text-center"
  >
    <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-gray-100">
      <ShieldQuestion className="size-10 text-gray-500" />
    </div>
    <h2 className="mb-3 text-xl font-semibold text-foreground">{title}</h2>
    <p className="max-w-md px-6 text-sm text-muted-foreground">{message}</p>
  </div>
);
