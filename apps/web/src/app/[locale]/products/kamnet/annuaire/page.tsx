import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { ShieldCheck, ShieldQuestion, Users } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import Navbar from '@/components/layout/navbar';
import Footer from '@/components/layout/footer';
import QuickActions from '@/components/floating/quick-actions';
import { CertificateNumberLookup } from '@/components/products/kamnet/certificate-number-lookup';
import { getPublicAgentDirectory } from '@/lib/actions/kamnet';
import { formatDate } from '@/lib/kbs';
import type { CertifiedAgentListing } from '@/types/kamnet';

/**
 * A listing is read from the register on every request. A cached entry served
 * after a withdrawal is the one thing this page must never do: consent can be
 * taken back at any moment and the effect is promised as immediate.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.annuaire');
  return { title: t('title'), description: t('description') };
}

/**
 * P11 - the public directory of certified agents.
 *
 * ---------------------------------------------------------------------------
 * Three states, and none of them may be mistaken for another
 * ---------------------------------------------------------------------------
 * `getPublicAgentDirectory` answers `[]` for "nobody has consented yet" and
 * `null` for "the register could not be read". They render differently on
 * purpose:
 *
 *   - `[]` says the directory is open and no agent has asked to appear. That is
 *     the ordinary state on the day this ships, and it is not a fault.
 *   - `null` says we cannot tell, and says so in words. Rendering an outage as
 *     an empty directory would tell a buyer there are no certified agents,
 *     which is false about the business and is exactly the shape
 *     `/verify-certificate` refuses with its `unavailable` verdict.
 *
 * An empty grid would read as a screen that failed to load, which is why
 * `network-empty.tsx` exists next door and why both states are cards with
 * sentences rather than an absence.
 *
 * ---------------------------------------------------------------------------
 * The KCA number is the point
 * ---------------------------------------------------------------------------
 * Each entry links its number into `/verify-certificate/<number>`, which asks
 * the register and answers about the certificate rather than the person. The
 * two surfaces are deliberately narrow in different directions: the directory
 * maps a name to a number, the verifier confirms the number and names nobody.
 *
 * ---------------------------------------------------------------------------
 * Why no photograph is rendered
 * ---------------------------------------------------------------------------
 * `UserProfile.avatarUrl` holds an **S3 key**, not a URL - its own schema
 * comment says so. Putting it in an `img` src would produce a broken image on a
 * public page for every agent who has one. The API carries the field, as the
 * subject requires; this page shows initials until something resolves a key to
 * a URL. Reported in WAVE_STATUS rather than guessed at.
 */
export default async function AgentDirectoryPage() {
  const t = await getTranslations('products.kamnet.directory');

  const res = await getPublicAgentDirectory();
  const entries = res.success ? res.data : null;

  return (
    <>
      <Navbar />
      <main className="bg-white">
        <section className="mx-auto max-w-5xl px-6 pt-20 pb-10 sm:px-8">
          <p className="text-sm font-medium text-primary-600">{t('eyebrow')}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-4 max-w-3xl text-base text-muted-foreground">{t('subtitle')}</p>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-16 sm:px-8">
          {entries === null ? (
            <Unavailable title={t('unavailableTitle')} message={t('unavailableMessage')} />
          ) : entries.length === 0 ? (
            <NotYetPublished title={t('emptyTitle')} message={t('emptyMessage')} />
          ) : (
            <ul data-directory="list" className="grid gap-4 sm:grid-cols-2">
              {entries.map((entry) => (
                <Entry
                  key={entry.kcaNumber}
                  entry={entry}
                  labels={{
                    kcaLabel: t('kcaLabel'),
                    verifyLink: t('verifyLink'),
                    certifiedSince: (date: string) => t('certifiedSince', { date }),
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="border-t border-border/45 bg-gray-50/50 px-6 py-16 sm:px-8">
          <div className="mx-auto max-w-xl">
            <h2 className="text-xl font-semibold text-foreground">{t('lookupTitle')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('lookupHint')}</p>
            <CertificateNumberLookup className="mt-6" />
          </div>
        </section>
      </main>
      <Footer />
      <QuickActions />
    </>
  );
}

type EntryLabels = {
  kcaLabel: string;
  verifyLink: string;
  certifiedSince: (date: string) => string;
};

/** Initials, because the stored avatar is an S3 key rather than a URL. */
const initials = (firstName: string, lastName: string) =>
  `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

const place = (entry: CertifiedAgentListing) =>
  [entry.city, entry.country].filter(Boolean).join(', ');

function Entry({ entry, labels }: { entry: CertifiedAgentListing; labels: EntryLabels }) {
  return (
    <li
      data-directory="entry"
      data-kca={entry.kcaNumber}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex items-start gap-4">
        <div
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-sm font-semibold text-primary-600"
        >
          {initials(entry.firstName, entry.lastName)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">
            {entry.firstName} {entry.lastName}
          </p>
          {place(entry) ? (
            <p className="truncate text-sm text-muted-foreground">{place(entry)}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {labels.certifiedSince(formatDate(entry.certifiedSince))}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/60 pt-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{labels.kcaLabel}</p>
          <p className="truncate font-mono text-sm font-semibold text-foreground">
            {entry.kcaNumber}
          </p>
        </div>
        <Link
          href={`/verify-certificate/${encodeURIComponent(entry.kcaNumber)}`}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline"
        >
          <ShieldCheck className="size-4" />
          {labels.verifyLink}
        </Link>
      </div>
    </li>
  );
}

/** The directory is open and nobody has asked to appear. Not a failure. */
const NotYetPublished = ({ title, message }: { title: string; message: string }) => (
  <div
    data-directory="empty"
    className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-20 text-center"
  >
    <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-primary-500/10">
      <Users className="size-10 text-primary-500" />
    </div>
    <h2 className="mb-3 text-xl font-semibold text-foreground">{title}</h2>
    <p className="max-w-md px-6 text-sm text-muted-foreground">{message}</p>
  </div>
);

/** We could not ask the register. This says so, and claims nothing else. */
const Unavailable = ({ title, message }: { title: string; message: string }) => (
  <div
    data-directory="unavailable"
    className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-20 text-center"
  >
    <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-gray-100">
      <ShieldQuestion className="size-10 text-gray-500" />
    </div>
    <h2 className="mb-3 text-xl font-semibold text-foreground">{title}</h2>
    <p className="max-w-md px-6 text-sm text-muted-foreground">{message}</p>
  </div>
);
