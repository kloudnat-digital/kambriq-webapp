export interface MockLand {
  id: string;
  title: string;
  slug: string;
  region: string;
  city: string;
  neighborhood: string;
  sizeM2: number;
  price: number;
  label: { code: string; name: string };
  isVerified: boolean;
  verifiedAt?: string;
  tfNumber?: string;
  status: 'available' | 'reserved';
  description?: string;
  features?: string[];
  topography?: string;
  waterAccess?: boolean;
  electricityAccess?: boolean;
  media: { url: string }[];
}

export const MOCK_LANDS: MockLand[] = [
  {
    id: '1',
    title: 'Terrain Dibamba',
    slug: 'terrain-dibamba',
    region: 'Littoral',
    city: 'Douala',
    neighborhood: 'Dibamba',
    sizeM2: 500,
    price: 7_500_000,
    label: { code: 'TDT', name: 'Titre Définitif' },
    isVerified: true,
    verifiedAt: '2024-11-15',
    tfNumber: 'TF/MFOUNDI/2024/0421',
    status: 'available',
    description:
      'Terrain plat situé à Dibamba, en bordure de route bitumée. Idéal pour un projet résidentiel ou commercial. Titre foncier définitif, vérifié et certifié par KAMBRIQ Verify.',
    features: ['Clôturé', 'Route bitumée', 'Zone résidentielle'],
    topography: 'Plat',
    waterAccess: true,
    electricityAccess: true,
    media: [
      {
        url: 'https://images.unsplash.com/photo-1764719396639-66ea940bb757?q=80&w=2670&auto=format&fit=crop',
      },
    ],
  },
  {
    id: '2',
    title: 'Terrain Yaoundé Bastos',
    slug: 'terrain-yaounde-bastos',
    region: 'Centre',
    city: 'Yaoundé',
    neighborhood: 'Bastos',
    sizeM2: 800,
    price: 18_000_000,
    label: { code: 'VEFL', name: "Vente en l'état futur de livraison" },
    isVerified: true,
    verifiedAt: '2025-01-08',
    tfNumber: 'TF/CENTRE/2025/0089',
    status: 'available',
    description:
      'Beau terrain à Bastos, quartier diplomatique et résidentiel de Yaoundé. Subdivision en cours avec titre foncier définitif garanti sous 12 mois. Environnement calme et sécurisé.',
    features: ['Quartier diplomatique', 'Sécurisé', 'Proche commodités'],
    topography: 'Légèrement en pente',
    waterAccess: true,
    electricityAccess: true,
    media: [
      {
        url: 'https://images.unsplash.com/photo-1764223531702-1614efb82e40?q=80&w=3732&auto=format&fit=crop',
      },
    ],
  },
  {
    id: '3',
    title: 'Terrain Bafoussam',
    slug: 'terrain-bafoussam',
    region: 'Ouest',
    city: 'Bafoussam',
    neighborhood: 'Tamdja',
    sizeM2: 650,
    price: 5_200_000,
    label: { code: 'TDT', name: 'Titre Définitif' },
    isVerified: false,
    status: 'available',
    description:
      'Terrain en zone périurbaine de Bafoussam. Environnement calme, idéal pour une construction individuelle.',
    features: ['Zone calme', 'Accès facile'],
    topography: 'Plat',
    waterAccess: true,
    electricityAccess: false,
    media: [
      {
        url: 'https://images.unsplash.com/photo-1669003152238-5bd17a5bb19c?q=80&w=2671&auto=format&fit=crop',
      },
    ],
  },
  {
    id: '4',
    title: 'Terrain Kribi Bord de Mer',
    slug: 'terrain-kribi-bord-de-mer',
    region: 'Sud',
    city: 'Kribi',
    neighborhood: 'Bord de Mer',
    sizeM2: 1_200,
    price: 32_000_000,
    label: { code: 'VEFL', name: "Vente en l'état futur de livraison" },
    isVerified: true,
    verifiedAt: '2025-02-20',
    tfNumber: 'TF/SUD/2025/0034',
    status: 'reserved',
    description:
      "Exceptionnel terrain en bord de mer à Kribi. Vue mer partielle, à quelques mètres de la plage. Idéal pour un projet touristique ou une villa de luxe. Titre en cours d'immatriculation avec garantie contractuelle.",
    features: ['Vue mer', 'Proche plage', 'Zone touristique', 'Très prisé'],
    topography: 'Plat',
    waterAccess: true,
    electricityAccess: true,
    media: [
      {
        url: 'https://images.unsplash.com/photo-1706333593437-90724b1d9432?q=80&w=3732&auto=format&fit=crop',
      },
    ],
  },
];
