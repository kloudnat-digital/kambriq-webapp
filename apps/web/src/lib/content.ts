import type { ComponentType } from 'react';

/**
 * Supported locales. Update this when adding a new language.
 */
export type ContentLocale = 'en' | 'fr';

/**
 * Supported content pages.
 * Add a new key here when you create a new content directory under src/content/.
 */
export type ContentPage =
  | 'about'
  | 'verify'
  | 'methode'
  | 'plan'
  | 'legal-mentions'
  | 'legal-terms'
  | 'legal-privacy'
  | 'legal-rgpd';

/**
 * Loads the MDX component for the given page and locale.
 *
 * Falls back to English if the requested locale file doesn't exist.
 * MDX files are compiled at build time by @next/mdx, so this is a
 * static import with no filesystem I/O at runtime.
 *
 * Usage (server component):
 *   const Content = await loadContent('about', locale);
 *   return <Content />;
 */
export async function loadContent(page: ContentPage, locale: string): Promise<ComponentType> {
  const safeLocale: ContentLocale = locale === 'fr' ? 'fr' : 'en';

  switch (`${page}/${safeLocale}`) {
    case 'about/fr': {
      const mod = await import('@/content/about/fr.mdx');
      return mod.default;
    }
    case 'about/en': {
      const mod = await import('@/content/about/en.mdx');
      return mod.default;
    }
    case 'verify/fr': {
      const mod = await import('@/content/verify/fr.mdx');
      return mod.default;
    }
    case 'verify/en': {
      const mod = await import('@/content/verify/en.mdx');
      return mod.default;
    }
    case 'methode/fr': {
      const mod = await import('@/content/methode/fr.mdx');
      return mod.default;
    }
    case 'methode/en': {
      const mod = await import('@/content/methode/en.mdx');
      return mod.default;
    }
    case 'plan/fr': {
      const mod = await import('@/content/plan/fr.mdx');
      return mod.default;
    }
    case 'plan/en': {
      const mod = await import('@/content/plan/en.mdx');
      return mod.default;
    }
    case 'legal-mentions/fr': {
      const mod = await import('@/content/legal/mentions/fr.mdx');
      return mod.default;
    }
    case 'legal-mentions/en': {
      const mod = await import('@/content/legal/mentions/en.mdx');
      return mod.default;
    }
    case 'legal-terms/fr': {
      const mod = await import('@/content/legal/terms/fr.mdx');
      return mod.default;
    }
    case 'legal-terms/en': {
      const mod = await import('@/content/legal/terms/en.mdx');
      return mod.default;
    }
    case 'legal-privacy/fr': {
      const mod = await import('@/content/legal/privacy/fr.mdx');
      return mod.default;
    }
    case 'legal-privacy/en': {
      const mod = await import('@/content/legal/privacy/en.mdx');
      return mod.default;
    }
    case 'legal-rgpd/fr': {
      const mod = await import('@/content/legal/rgpd/fr.mdx');
      return mod.default;
    }
    case 'legal-rgpd/en': {
      const mod = await import('@/content/legal/rgpd/en.mdx');
      return mod.default;
    }
    default: {
      const mod = await import('@/content/about/en.mdx');
      return mod.default;
    }
  }
}
