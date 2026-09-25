/**
 * Mock implementation of `@/i18n/navigation` for component tests.
 *
 * The real module is built by `createNavigation`, and its `Link` reads the
 * active locale from next-intl's own React context - from inside next-intl's
 * bundle, not through the app's `next-intl` import. So a spec that mocks
 * `next-intl` does not satisfy it, and rendering any `Link` dies with
 * "No intl context found" before the component under test does anything.
 *
 * What this does NOT prove, stated so nobody reads a green suite as evidence
 * of it: that a rendered href carries its locale prefix. That is next-intl's
 * behaviour rather than this app's, and it is checked where it is observable -
 * `apps/web-e2e` navigates a running app and reads the URL.
 *
 * @example
 * jest.mock('@/i18n/navigation', () => require('@/test-utils/navigation-mock'));
 */
import type { AnchorHTMLAttributes, ReactNode } from 'react';

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string | { pathname: string; query?: Record<string, string> };
  locale?: string;
  children?: ReactNode;
};

const toHref = (href: LinkProps['href']): string => {
  if (typeof href === 'string') return href;
  const query = href.query ? `?${new URLSearchParams(href.query).toString()}` : '';
  return `${href.pathname}${query}`;
};

export const Link = ({ href, locale: _locale, children, ...rest }: LinkProps) => (
  <a href={toHref(href)} {...rest} data-locale={_locale}>
    {children}
  </a>
);

export const usePathname = () => '/';

export const useRouter = () => ({
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
});

/** Throws, exactly as the real one does, so a redirect still aborts a render. */
export const redirect = (args: { href: LinkProps['href']; locale: string }): never => {
  throw new Error(`NEXT_REDIRECT:${args.locale}:${toHref(args.href)}`);
};

export const getPathname = ({ href, locale }: { href: LinkProps['href']; locale: string }) =>
  `/${locale}${toHref(href)}`;
