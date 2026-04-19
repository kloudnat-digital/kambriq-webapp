export const siteConfig = {
  name: 'KAMBRIQ',
  description: "Votre partenaire de confiance pour investir dans l'immobilier au Cameroun",

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
    instagram: 'https://www.instagram.com/kambriq',
    youtube: 'https://www.youtube.com/@kambriq',
    tiktok: 'https://www.tiktok.com/@kambriq',
    twitter: 'https://x.com/kambriq',
  },

  defaultLocale: 'fr' as const,
  supportedLocales: ['fr', 'en'] as const,
} as const;

export type SiteConfig = typeof siteConfig;
