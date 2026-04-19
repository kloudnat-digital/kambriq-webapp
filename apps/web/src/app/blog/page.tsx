import Navbar from '@/components/layout/navbar';
import Footer from '@/components/layout/footer';
import QuickActions from '@/components/floating/quick-actions';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function BlogPage() {
  const t = await getTranslations('blog');

  const season1 = [
    'Les 4 domaines fonciers au Cameroun',
    "Le titre foncier, c'est quoi exactement ?",
    'Domaine national vs domaine privé',
    "Pourquoi c'est compliqué",
    'Ce que la diaspora doit savoir',
  ];

  return (
    <>
      <Navbar />
      <main className="bg-white pt-[73px]">
        <section className="mx-auto max-w-3xl px-6 py-16 sm:px-8 sm:py-24">
          <p className="text-sm font-semibold tracking-widest text-primary uppercase">
            {t('eyebrow')}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mt-6 text-lg/8 text-gray-600">{t('subtitle')}</p>
        </section>

        <section className="border-t border-border/45 px-6 py-16 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-semibold text-gray-900">{t('season1.title')}</h2>
            <ol className="mt-8 space-y-4">
              {season1.map((title, i) => (
                <li key={i} className="flex gap-4 rounded-lg border border-border bg-card p-5">
                  <span className="font-mono text-sm font-semibold text-primary">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-gray-700">{title}</span>
                </li>
              ))}
            </ol>
            <p className="mt-10 text-sm text-gray-500">{t('comingSoon')}</p>

            <div className="mt-10 flex flex-col gap-2 text-sm text-gray-600">
              <p className="font-medium">{t('follow')}</p>
              <Link
                href="https://www.linkedin.com/company/kambriq"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary"
              >
                LinkedIn
              </Link>
              <Link
                href="https://www.facebook.com/profile.php?id=61576162540542"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary"
              >
                Facebook
              </Link>
              <Link
                href="https://www.youtube.com/@kambriq"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary"
              >
                YouTube
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <QuickActions />
    </>
  );
}
