import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { auth } from '@/auth';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';
import ToastContainer from '@/components/ui/toast-container';
import './globals.css';
import { cn } from '@/lib/utils';

// Fonts
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

// Viewport (theme-color lives here in Next.js 14+)
export const viewport: Viewport = {
  themeColor: '#0D1B2A',
};

// Metadata
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
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
          alt: 'KAMBRIQ — Foncier camerounais. Vérifié. Accompagné.',
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
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, messages, session] = await Promise.all([getLocale(), getMessages(), auth()]);

  return (
    <html lang={locale} suppressHydrationWarning className={cn(jetbrainsMono.variable, 'h-full')}>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/css?f%5B%5D=switzer@400,500,600,700,800&display=swap"
        />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers session={session}>{children}</Providers>
          <Toaster theme="light" closeButton className="font-sans" />
          <ToastContainer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
