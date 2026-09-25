import { notFound } from 'next/navigation';
import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { getTranslations } from 'next-intl/server';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { auth } from '@/auth';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';
import ToastContainer from '@/components/ui/toast-container';
import '../globals.css';
import { BRAND_NAVY } from '@/lib/brand-colors';
import { routing, type Locale } from '@/i18n/routing';
import { JsonLd, siteJsonLd } from '@/lib/seo/json-ld';
import { sessionForClient } from '@/lib/session';
import { FONT_STYLESHEET_URL, fontSrcSources, styleSrcSources } from '@/lib/security/image-hosts';
import { cn } from '@/lib/utils';

// Fonts
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

/**
 * This is the application's root layout, although it sits under a dynamic
 * segment.
 *
 * Next.js treats any layout with no `layout` file above it as a root layout,
 * and documents `app/[lang]/layout.js` as the supported shape for
 * internationalisation. There is deliberately no `app/layout.tsx`: two files
 * both rendering `<html>` is invalid, and the locale has to be readable where
 * `lang` is set.
 *
 * Outside this segment sit only route handlers (`app/api`, `app/health`),
 * which need no layout, and `app/global-error.tsx`, which renders its own
 * document and must stay at the app root.
 */

/**
 * The locale segment accepts the configured locales and nothing else.
 *
 * `[locale]` matches any single first segment, so `/pricing` would otherwise
 * render the home page with HTTP 200 - a soft 404, which a crawler indexes and
 * no monitor counts.
 *
 * The refusal is the `hasLocale` check in the layout below rather than
 * `dynamicParams = false`. Both answer 404, and they differ in WHICH 404:
 * `dynamicParams` refuses inside Next's routing, before any of this code runs,
 * so the visitor gets the built-in "404: This page could not be found" instead
 * of the page P3 built with links back into the site - and an unprefixed typo
 * is the commonest way anybody arrives at a 404 at all. Calling `notFound()`
 * from the layout renders `[locale]/not-found.tsx` with the same status.
 *
 * `[...rest]/page.tsx` covers the other half: a path that is unmatched UNDER a
 * valid locale, which reaches this layout successfully and would otherwise fall
 * through to the same built-in page.
 */
export const generateStaticParams = () => routing.locales.map((locale) => ({ locale }));

// Viewport (theme-color lives here in Next.js 14+).
//
// A Viewport value is serialised into <meta name="theme-color"> at build time,
// so it cannot be a CSS variable - hence the constant rather than a token.
export const viewport: Viewport = {
  themeColor: BRAND_NAVY,
};

// Metadata
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const description = t('description');
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://dev.kambriq.com'),
    title: {
      default: 'KAMBRIQ',
      template: '%s | KAMBRIQ',
    },
    description,
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
        { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      ],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
    manifest: '/site.webmanifest',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: 'KAMBRIQ',
    },
    openGraph: {
      type: 'website',
      siteName: 'KAMBRIQ',
      title: 'KAMBRIQ',
      description,
      images: [
        {
          url: '/og-image-1200x630.png',
          width: 1200,
          height: 630,
          alt: 'KAMBRIQ - Foncier camerounais. Vérifié. Accompagné.',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'KAMBRIQ',
      description,
      images: ['/twitter-card-1200x600.png'],
    },
  };
}

// Root Layout
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  /**
   * The refusal, and the only one: an unconfigured first segment is not a
   * language, and rendering the default catalogue under it would publish the
   * French site at `/pricing` and at every typo, with HTTP 200.
   *
   * `locale-routing.spec.ts` asserts the status over HTTP for `/de`, `/es` and
   * `/zzz`, because nothing here can observe what a visitor is actually served.
   */
  if (!hasLocale(routing.locales, locale)) notFound();

  // Only the client-safe half of the session crosses into <Providers>, which
  // is a Client Component. See lib/session.ts.
  const session = sessionForClient(await auth());

  return (
    <html lang={locale} suppressHydrationWarning className={cn(jetbrainsMono.variable, 'h-full')}>
      <head>
        {/* J11: the typeface's hosts live with the CSP's, in lib/security/image-hosts.ts. */}
        <link key="font-preconnect" rel="preconnect" href={styleSrcSources()[0]} />
        <link
          key="font-files-preconnect"
          rel="preconnect"
          href={fontSrcSources()[0]}
          crossOrigin=""
        />
        <link key="font-stylesheet" rel="stylesheet" href={FONT_STYLESHEET_URL} />
      </head>
      <body>
        {/* Structured data, which this site carried none of. See lib/seo/json-ld.tsx. */}
        <JsonLd data={siteJsonLd(locale as Locale)} />
        <NextIntlClientProvider>
          <Providers session={session}>{children}</Providers>
          <Toaster theme="light" closeButton className="font-sans" />
          <ToastContainer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
