export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';

import { getMyLeads } from '@/lib/actions/kamnet';
import { ProspectsContent } from './prospects-content';
import { ALL_STATUSES, isLeadStatus } from './lead-status';
import type { Lead } from '@/types/kamnet';

/**
 * `/agent/prospects` - the screen that makes prospection possible.
 *
 * Section 9 of the base comprehension document calls this "le premier moment ou
 * l'engagement est tenu a moitie": the first point at which an agent can record
 * a contact and follow it. What it replaces is a 25-line delegation to
 * `PlaceholderPage` advertising four features it did not have.
 *
 * The data comes from `kamnet/leads` through the action layer step 1 shipped.
 * Nothing here is invented: an agent with no prospects sees an empty state, and
 * a failed read shows the same empty state rather than fabricated rows.
 *
 * Filter and search are URL state, read here from `searchParams` and written by
 * the client component through `nuqs` with `shallow: false`, so this server
 * component refetches. That is the pattern `admin/kbs/candidates` uses.
 *
 * `ALL` is a sentinel rather than an empty string: Radix `Select` refuses
 * `value=""`. It is mapped to NO status parameter, which is what makes the
 * filter clearable - the screen this one follows cannot clear its own filter.
 */

interface Props {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}

export async function generateMetadata() {
  const t = await getTranslations('app.prospects');
  return { title: t('pageTitle') };
}

export default async function ProspectsPage({ searchParams }: Props) {
  const t = await getTranslations('app.prospects');
  const sp = await searchParams;

  /**
   * A query string can carry anything, so the status is CHECKED against the
   * five rather than cast to them. `?status=WOBBLE` becomes no filter at all
   * instead of reaching the API as a value it would refuse - and `ALL` is the
   * sentinel for "every status", which is also no filter.
   */
  const requested = sp.status;
  const status =
    requested && requested !== ALL_STATUSES && isLeadStatus(requested) ? requested : undefined;
  const search = sp.search?.trim() ? sp.search.trim() : undefined;
  const page = sp.page ? Number(sp.page) : 1;

  const res = await getMyLeads({ status, search, page, limit: 20 });

  const rows: Lead[] = res.success ? res.data.data : [];
  const meta = res.success ? res.data.meta : { total: 0, totalPages: 1, page: 1, limit: 20 };

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <ProspectsContent rows={rows} meta={meta} filtered={Boolean(status || search)} />
      </div>
    </div>
  );
}
