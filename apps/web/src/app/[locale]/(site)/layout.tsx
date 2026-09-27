import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import type { ReactNode } from 'react';
import { routing } from '@/i18n/routing';

/**
 * P31 - every page of the site sits in this group, and the group accepts the
 * configured locales and nothing else.
 *
 * `[locale]` matches any single first segment, so `/pricing` and `/de/about`
 * reach this layout. The refusal lives here rather than in the root layout
 * because a `notFound()` thrown by the root layout has no boundary above it,
 * and Next serves its built-in page. Thrown here, it is caught by
 * `[locale]/not-found.tsx`, which renders the branded 404 inside the root
 * layout, with HTTP 404, in the visitor's language.
 */
export default async function SiteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return children;
}
