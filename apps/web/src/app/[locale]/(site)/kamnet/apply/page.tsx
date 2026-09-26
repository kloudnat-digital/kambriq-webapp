import { getLocale, getTranslations } from 'next-intl/server';
import Navbar from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { getMyApplicationStanding } from '@/lib/actions/kamnet';
import { formatHumanDateTime } from '@kambriq/common/payments/payment-format';
import { ApplyForm } from './apply-form';

/**
 * P5 - `/kamnet/apply`, wired to the API.
 *
 * It used to be a mock: its submit toasted "Candidature soumise !" and stored
 * nothing. It now reads where the signed-in person stands and says only what is
 * true: they need a certificate first, or their application's real status, or -
 * when they may apply - a form that posts to `POST /kamnet/applications`. The
 * API stores the application, emails the applicant, and announces it to the
 * contact inbox. When the standing cannot be read, the page says so rather than
 * guessing.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('kamnetApply');
  return { title: t('title') };
}

export default async function KamnetApplyPage() {
  const t = await getTranslations('kamnetApply');
  const locale = await getLocale();
  const result = await getMyApplicationStanding();
  const standing = result.success ? result.data : ({ state: 'unavailable' } as const);

  const contact = (
    <Button asChild variant="outline">
      <Link href="/contact">{t('contact')}</Link>
    </Button>
  );

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-18.25">
        <div className="mx-auto max-w-xl space-y-6 px-6 py-14 sm:px-8">
          <h1 className="text-2xl font-bold">{t('title')}</h1>

          {standing.state === 'unavailable' && (
            <section className="space-y-4 rounded-2xl border border-border bg-white p-8">
              <p className="text-sm text-gray-700">{t('unavailable')}</p>
              {contact}
            </section>
          )}

          {standing.state === 'not-certified' && (
            <section className="space-y-4 rounded-2xl border border-border bg-white p-8">
              <p className="text-sm text-gray-700">{t('notCertified')}</p>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/products/kbs">{t('kbs')}</Link>
                </Button>
                {contact}
              </div>
            </section>
          )}

          {standing.state === 'applied' && (
            <section
              data-testid="kamnet-application-status"
              className="space-y-3 rounded-2xl border border-border bg-white p-8"
            >
              <h2 className="text-lg font-semibold">
                {t(`status.${standing.application.status}.label`)}
              </h2>
              <p className="text-sm text-gray-700">
                {t(`status.${standing.application.status}.body`, {
                  date: formatHumanDateTime(
                    standing.application.createdAt,
                    locale === 'en' ? 'en-GB' : 'fr-FR',
                  ),
                })}
              </p>
              {standing.application.reviewNote && (
                <p className="text-sm text-gray-600">{standing.application.reviewNote}</p>
              )}
            </section>
          )}

          {standing.state === 'can-apply' && <ApplyForm kcaNumber={standing.kcaNumber} />}
        </div>
      </main>
    </>
  );
}
