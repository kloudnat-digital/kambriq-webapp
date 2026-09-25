/**
 * Global site configuration settings.
 */
export const siteConfig = {
  name: 'KAMBRIQ',
  description:
    'Conseil en stratégie foncière au Cameroun. Vérification, sécurisation et accompagnement de votre projet foncier.',

  contact: {
    email: 'contact@kambriq.com',
    whatsapp: {
      number: '+33745909856',
      displayNumber: '+33 7 45 90 98 56',
      message:
        "Bonjour, j'ai un projet foncier au Cameroun et je voudrais en savoir plus sur KAMBRIQ.",
    },
    phone: {
      local: '+237653420268',
      displayLocal: '+237 653 42 02 68',
    },
    address: 'Douala-Dibamba, Cameroun',
  },

  social: {
    linkedin: 'https://www.linkedin.com/company/kambriq',
    facebook: 'https://www.facebook.com/profile.php?id=61576162540542',
    youtube: 'https://www.youtube.com/@kambriq',
  },

  defaultLocale: 'fr' as const,
  supportedLocales: ['fr', 'en'] as const,
} as const;

export type SiteConfig = typeof siteConfig;
