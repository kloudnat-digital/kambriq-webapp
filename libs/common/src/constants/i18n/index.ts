export const SUPPORTED_LANGUAGES = ['en', 'fr'] as const;
export const DEFAULT_LANGUAGE = 'fr';
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
