'use client';

import { useTranslations } from 'next-intl';
import Navbar from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

/**
 * P5, the floor - this page says an application was received only when one was.
 *
 * It used to render a form whose submit waited 800 ms and toasted "Candidature
 * soumise !" - nothing was sent, nothing was stored - while recruiting was live.
 * Until it is wired to `POST /kamnet/applications`, it says applications are not
 * open online and sends people to the contact form, whose "Devenir agent
 * KAMNET™" subject is stored and notified (L1).
 */
export default function KamnetApplyPage() {
  const t = useTranslations('kamnetApply.closed');

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-18.25">
        <div className="mx-auto max-w-xl px-6 py-14 sm:px-8">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <div className="mt-6 space-y-4 rounded-2xl border border-border bg-white p-8 shadow-sm">
            <p className="text-sm text-gray-700">{t('body')}</p>
            <p className="text-sm text-gray-700">{t('how')}</p>
            <Button asChild>
              <Link href="/contact">{t('contact')}</Link>
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
