import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://dev.kambriq.com';

const STATIC_PATHS: ReadonlyArray<{
  path: string;
  priority?: number;
  changeFrequency?: MetadataRoute.Sitemap[number]['changeFrequency'];
}> = [
  { path: '/', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/methode', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.6, changeFrequency: 'yearly' },
  { path: '/faq', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/products/lands', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/products/verify', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/products/kamnet', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/products/kbs', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/legal/mentions', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/legal/terms', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/legal/privacy', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/legal/cookies', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/legal/mandat-verify', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/mandat-accompagnement', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/kyc-aml', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/rgpd', priority: 0.5, changeFrequency: 'yearly' },
  { path: '/legal/rgpd/ue', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/legal/rgpd/uk', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/legal/rgpd/ch', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/legal/rgpd/ca', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/legal/rgpd/us-ca', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/legal/rgpd/global', priority: 0.4, changeFrequency: 'yearly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return STATIC_PATHS.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
