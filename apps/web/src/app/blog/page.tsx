import type { Metadata } from 'next';
import Navbar from '@/components/layout/navbar';
import Footer from '@/components/layout/footer';
import QuickActions from '@/components/floating/quick-actions';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.blog');
  return { title: t('title'), description: t('description') };
}

export default async function BlogPage() {
  const t = await getTranslations('blog');
  const season1 = t.raw('season1.items') as string[];

  return (
    <>
      <Navbar />
      <main className="bg-white">
        <section className="bg-surface-100">
          <div className="mx-auto max-w-3xl px-6 py-16 sm:px-8 sm:py-24">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
              {t('eyebrow')}
            </p>
            <h1 className="mt-4 font-serif text-4xl leading-[1.05] font-semibold tracking-[-0.02em] text-pretty text-accent sm:text-5xl">
              {t('title')}
            </h1>
            <p className="mt-5 text-lg leading-[1.65] text-surface-600">{t('subtitle')}</p>
          </div>
        </section>

        <section className="border-t border-border px-6 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-serif text-3xl font-semibold text-accent">{t('season1.title')}</h2>
            <ol className="mt-8 space-y-3">
              {season1.map((title, i) => (
                <li key={i} className="flex gap-4 rounded-lg border border-border bg-white p-5">
                  <span className="font-mono text-sm font-semibold text-primary">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-surface-700">{title}</span>
                </li>
              ))}
            </ol>
            <p className="mt-10 text-sm text-surface-500">{t('comingSoon')}</p>

            <div className="mt-10 flex flex-col gap-2 text-sm text-surface-600">
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
