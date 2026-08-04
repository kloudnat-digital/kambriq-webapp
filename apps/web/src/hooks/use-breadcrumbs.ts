'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

export interface BreadcrumbItem {
  label: string;
  href: string;
  isLast: boolean;
  clickable: boolean;
}

// Known static path segments and their translation keys in app.breadcrumbs
const STATIC_SEGMENTS: Record<string, string> = {
  lands: 'lands',
  mylands: 'mylands',
  reservations: 'reservations',
  profile: 'profile',
  settings: 'settings',
  invite: 'invite',
  admin: 'admin',
  agent: 'agent',
  kbs: 'kbs',
  purchase: 'purchase',
  compare: 'compare',
  search: 'search',
};

// Segments that are part of the URL structure but have no page of their own.
// Rendered as plain text (no link) so users don't get a 404.
const NON_CLICKABLE_SEGMENTS = new Set<string>(['purchase']);

export function useBreadcrumbs(labels: Record<string, string> = {}): BreadcrumbItem[] {
  const pathname = usePathname();
  const t = useTranslations('app.breadcrumbs');

  const segments = pathname.split('/').filter(Boolean);

  return segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/');
    const isLast = i === segments.length - 1;

    let label: string;
    if (labels[seg]) {
      label = labels[seg];
    } else if (STATIC_SEGMENTS[seg]) {
      label = t(STATIC_SEGMENTS[seg]);
    } else {
      label = seg;
    }

    return { label, href, isLast, clickable: !NON_CLICKABLE_SEGMENTS.has(seg) };
  });
}
