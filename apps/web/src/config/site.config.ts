export const siteConfig = {
  name: 'KAMBRIQ',
  description: "Votre partenaire de confiance pour investir dans l'immobilier au Cameroun",

  contact: {
    email: 'contact@kambriq.com',
    whatsapp: {
      number: '+33646426706',
      displayNumber: '+33 6 46 42 67 06',
      message: "Bonjour, je souhaite obtenir plus d'informations sur KAMBRIQ.",
    },
    phone: {
      local: '+237653420268',
      displayLocal: '+237 653 42 02 68',
    },
    address: 'Douala-Dibamba, Cameroun',
  },

  social: {
    linkedin: 'https://www.linkedin.com/company/kambriq',
    facebook: 'https://www.facebook.com/kambriq',
    instagram: 'https://www.instagram.com/kambriq',
    youtube: 'https://www.youtube.com/@kambriq',
    tiktok: 'https://www.tiktok.com/@kambriq',
    twitter: 'https://x.com/kambriq',
  },

  defaultLocale: 'fr' as const,
  supportedLocales: ['fr', 'en'] as const,
} as const;

export type SiteConfig = typeof siteConfig;
