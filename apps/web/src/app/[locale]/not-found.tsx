import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

import Navbar from '@/components/layout/navbar';
import Footer from '@/components/layout/footer';
import { Button } from '@/components/ui/button';

/**
 * P3 - the 404 page, which the site did not have.
 *
 * ---------------------------------------------------------------------------
 * Why there was none
 * ---------------------------------------------------------------------------
 * There is no `not-found.tsx` in the history of this app. What answered a
 * missing page was Next's **built-in** default - the bare
 * "404: This page could not be found." - and it was reachable on almost
 * nothing, because the middleware matcher intercepted every unknown URL and
 * redirected it to `/login`. Measured before the change, the only 404 the site
 * could produce was under `/api/*`, which the matcher happened to exclude.
 *
 * So a visitor who mistyped a URL, or followed a link to a page that had moved,
 * was asked to sign in. That reads as "this content is behind a members' area"
 * rather than "this page does not exist", and for a public marketing site it
 * loses the visitor at the first mistake.
 *
 * ---------------------------------------------------------------------------
 * The status code is the thing
 * ---------------------------------------------------------------------------
 * Next returns **HTTP 404** for this file automatically, and that is the part
 * that matters rather than the words on it. A page that says "not found" over a
 * 200 is worse than no page at all: a crawler indexes it, a monitor reports the
 * site healthy, and every broken URL becomes a soft 404 nobody can count.
 * `not-found.spec.ts` asserts the status, not the copy.
 *
 * It carries links back into the site because a dead end with no exit is the
 * other half of the same defect.
 */
export const metadata: Metadata = {
  title: '404',
  // Belt and braces beside the header: a page that does not exist should not be
  // indexed on any environment, production included.
  robots: { index: false, follow: false },
};

const NotFound = async () => {
  const t = await getTranslations('notFound');

  const destinations = [
    { href: '/', label: t('links.home') },
    { href: '/products/lands', label: t('links.lands') },
    { href: '/contact', label: t('links.contact') },
    { href: '/faq', label: t('links.faq') },
  ];

  return (
    <>
      <Navbar />
      <main className="pt-[73px]">
        <section className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center sm:px-8">
          <p className="font-mono text-sm font-semibold tracking-widest text-primary-600 uppercase">
            {t('code')}
          </p>
          <h1 className="mt-4 text-4xl font-bold text-gray-900">{t('title')}</h1>
          <p className="mt-4 text-gray-600">{t('description')}</p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/">{t('links.home')}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/contact">{t('links.contact')}</Link>
            </Button>
          </div>

          {/* Named destinations rather than "go back": somebody who arrived on a
              dead link has nowhere useful to go back to. */}
          <nav aria-label={t('suggestionsLabel')} className="mt-10 w-full">
            <p className="mb-3 text-sm font-medium text-gray-500">{t('suggestions')}</p>
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
              {destinations.map((d) => (
                <li key={d.href}>
                  <Link
                    href={d.href}
                    className="text-primary-600 underline underline-offset-2 hover:text-primary-700"
                  >
                    {d.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default NotFound;
