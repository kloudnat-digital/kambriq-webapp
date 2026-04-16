/**
 * Centralised app configuration.
 * All env vars are read here - never import process.env directly in components.
 */
export const appConfig = {
  apiUrl: process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000',
  appUrl: process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3001',
  appName: 'KAMBRIQ',
  mapboxToken: process.env['NEXT_PUBLIC_MAPBOX_TOKEN'] ?? '',
  defaultLocale: 'fr' as const,
  supportedLocales: ['fr', 'en'] as const,
} as const;

export type SupportedLocale = (typeof appConfig.supportedLocales)[number];
