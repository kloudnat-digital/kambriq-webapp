import type { Metadata } from 'next';
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

// Metadata
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return {
    title: {
      default: 'KAMBRIQ',
      template: '%s | KAMBRIQ',
    },
    description: t('description'),
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
