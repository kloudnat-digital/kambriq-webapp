/**
 * The LANDS catalogue, v07.5 (`prd_lands_catalogue_v07.5.docx`, 6 100 771 bytes,
 * md5 59742c15248f89713418cfcfac0edb4c, modified 2026-10-01 14:52:05 UTC).
 *
 * Generated from the extraction `catalogue_v075.json`, checked field by field
 * against the document for all twenty fiches; fiche 008 was completed from the
 * document. `totalPrice` is `sizeM2 x pricePerM2`, arithmetic on the fiche, never
 * an estimate. The catalogue marks prices "PRIX INDICATIF"; the platform shows
 * them as firm (decision of 1 October 2026).
 *
 * `titleNumber` is null on every parcel: no fiche states a title that belongs to
 * the lot itself. TF 9085/SM is the title 010A and 010B are carved from, and the
 * column is unique, so it cannot be either lot's own number.
 *
 * `region` is inferred from the city (Douala: Littoral; Yaoundé, Nkométou,
 * Obala: Centre); the document does not state it. `city` is the town before the
 * dash in the fiche's LOCALISATION; `neighborhood` is the summary table's Zone
 * column, because the fiche runs the zone and the access notes together.
 */

export type CatalogueLabel = 'TFL' | 'VEFL' | 'VEFIL';

export interface CatalogueParcel {
  readonly id: string;
  readonly ref: string;
  readonly num: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly region: string;
  readonly city: string | null;
  readonly neighborhood: string | null;
  readonly sizeM2: number;
  readonly pricePerM2: number;
  readonly totalPrice: number;
  readonly label: CatalogueLabel;
  /** The fiche says "✓ Validé"; only these may be published. */
  readonly validated: boolean;
  /** Null until a lot's own title is in `real-titles.ts`. */
  readonly titleNumber: string | null;
}

/** A site: a price per m2 and an announced surface, no total, not reservable. Not loaded. */
export interface CatalogueSite {
  readonly ref: string;
  readonly num: string;
  readonly title: string;
  readonly surfaceText: string;
  readonly priceText: string;
  readonly pricePerM2: number | null;
  readonly label: CatalogueLabel;
}

export const CATALOGUE_PARCELS: readonly CatalogueParcel[] = [
  {
    id: '34b4fa82-192b-44ac-8a16-804f2166291e',
    ref: 'KAM-LANDS_DLA-DIBAMBA_KENDECK-ZI-ZA_001',
    num: '001',
    title: 'Kendeck - Site Hôtel SAATCH (Lot 1)',
    slug: 'kam-lands-dla-dibamba-kendeck-zi-za-001',
    description:
      'Zone Industrielle et d’Activité. Futur Hôtel SAATCH à proximité immédiate. 5 usines en fonctionnement (Fish&CO, SOFTCARE...). Alimentation électrique. École primaire. Axe de raccordement N3 - A1 (Yaoundé-Douala).\n\nAccès : N3, Axe ZI viabilisation\n\nÉtat des documents : ✓ Immatriculation / ✓ Plan de situation / ✓ Dossier technique / ✓ Lotissement',
    region: 'Littoral',
    city: 'Douala',
    neighborhood: 'Dibamba / Quartier Kendeck',
    sizeM2: 400,
    pricePerM2: 17000,
    totalPrice: 6800000,
    label: 'TFL',
    validated: true,
    titleNumber: null,
  },
  {
    id: 'e9508bdd-4f84-4bb7-8f60-874d83c96417',
    ref: 'KAM-LANDS_DLA-DIBAMBA_KENDECK-ZI-ZA_002',
    num: '002',
    title: 'Kendeck - Site Hôtel SAATCH (Lot 2)',
    slug: 'kam-lands-dla-dibamba-kendeck-zi-za-002',
    description:
      'Zone Industrielle et d’Activité. Futur Hôtel SAATCH à proximité immédiate. 5 usines en fonctionnement (Fish&CO, SOFTCARE...). Alimentation électrique. École primaire. Axe de raccordement N3 - A1 (Yaoundé-Douala).\n\nAccès : N3, Axe ZI viabilisation\n\nÉtat des documents : ✓ Immatriculation / ✓ Plan de situation / ✓ Dossier technique / ✓ Lotissement',
    region: 'Littoral',
    city: 'Douala',
    neighborhood: 'Dibamba / Quartier Kendeck',
    sizeM2: 400,
    pricePerM2: 17000,
    totalPrice: 6800000,
    label: 'TFL',
    validated: true,
    titleNumber: null,
  },
  {
    id: 'dbf1a1cf-5c46-4f84-8673-ceab00873a36',
    ref: 'KAM-LANDS_DIBAMBA_YEBI-PADEX_ZI-ZA-ZC_003',
    num: '003',
    title: 'Yebi-Padex - Zone Université (Lot 3)',
    slug: 'kam-lands-dibamba-yebi-padex-zi-za-zc-003',
    description:
      'Zone Industrielle, d’Activité et Commerciale. Université en construction à 100m. Usine en construction. Résidences haut standing en construction. 3 usines en fonctionnement. Axe de raccordement N3 - PADEX.\n\nAccès : N3, Axe ZI viabilisation\n\nÉtat des documents : ✓ Immatriculation / ✓ Plan de situation / ✓ Dossier technique / ✓ Lotissement',
    region: 'Littoral',
    city: 'Douala',
    neighborhood: 'Dibamba / Quartier Yebi-Padex',
    sizeM2: 1000,
    pricePerM2: 25000,
    totalPrice: 25000000,
    label: 'TFL',
    validated: true,
    titleNumber: null,
  },
  {
    id: '1e81f8b8-8d47-4a92-80ab-4a36b5324550',
    ref: 'KAM-LANDS_DIBAMBA_BOULOU-PADEX_ZI-ZA-ZC_004',
    num: '004',
    title: 'Boulou-Padex - Zone Université (Lot 4)',
    slug: 'kam-lands-dibamba-boulou-padex-zi-za-zc-004',
    description:
      'Zone Industrielle, d’Activité et Commerciale. Université en construction à 100m. Usine en construction. Résidences haut standing en construction. 3 usines en fonctionnement. Axe de raccordement N3 - PADEX.\n\nAccès : N3, Axe ZI viabilisation\n\nÉtat des documents : ✓ Immatriculation / ✓ Plan de situation / ✓ Dossier technique / ✓ Lotissement',
    region: 'Littoral',
    city: 'Douala',
    neighborhood: 'Dibamba / Quartier Boulou-Padex',
    sizeM2: 1000,
    pricePerM2: 25000,
    totalPrice: 25000000,
    label: 'TFL',
    validated: true,
    titleNumber: null,
  },
  {
    id: '2395eed5-bf01-46a9-8f60-eb1413ee6754',
    ref: 'KAM-LANDS_DIBAMBA_MBONGO-PADEX_ZI-ZA-ZC_005',
    num: '005',
    title: 'Mbongo - Carrefour Mbongo',
    slug: 'kam-lands-dibamba-mbongo-padex-zi-za-zc-005',
    description:
      'Lycée de Mbongo. Université en construction. Zone commerciale du carrefour Mbongo. Nationale N3 à proximité.\n\nAccès : Axe Carrefour Mbongo - Zone d’activité\n\nÉtat des documents : ✓ Plan de lotissement / ✓ Titre Foncier / ‒ Dossier technique / ‒ Bornage',
    region: 'Littoral',
    city: 'Douala',
    neighborhood: 'Dibamba / Quartier Mbongo',
    sizeM2: 800,
    pricePerM2: 10000,
    totalPrice: 8000000,
    label: 'TFL',
    validated: true,
    titleNumber: null,
  },
  {
    id: '20060e5f-5e15-4750-81a5-4f3164ba3a5f',
    ref: 'KAM-LANDS_DIBAMBA_MISSOLE2-N3_006',
    num: '006',
    title: 'Missolé 2 - Mitoyen Port Sec',
    slug: 'kam-lands-dibamba-missole2-n3-006',
    description:
      'Port Sec (projet à venir). Zone du Parc Oriental de Douala-Dibamba. Nationale N3 à proximité. Lotissement TF 7656/SM (secteur Ngah-Koumda).\n\nAccès : Axe N3\n\nÉtat des documents : ✓ Plan de lotissement / ✓ Titre Foncier / ✓ Bornage / ‒ Dossier technique',
    region: 'Littoral',
    city: 'Douala',
    neighborhood: 'Dibamba / Missolé 2',
    sizeM2: 2750,
    pricePerM2: 8000,
    totalPrice: 22000000,
    label: 'TFL',
    validated: true,
    titleNumber: null,
  },
  {
    id: '97532e4e-78cc-459a-8eae-7a2cc6c066ef',
    ref: 'KAM-LANDS_DLA-DIBAMBA_MISSOLE2-PK38_010A',
    num: '010A',
    title: 'Missolé 2 PK38 - Lot A (492 m²)',
    slug: 'kam-lands-dla-dibamba-missole2-pk38-010a',
    description:
      'Zone Missolé 2 PK38, voisinage du Lycée de Mbongo. Université en construction. Mitoyen du Parc Oriental de Douala-Dibamba. Futur Port Sec à venir. Axe N3 Douala-Yaoundé.\n\nAccès : Route N3, axe PK38\n\nÉtat des documents : ✓ Immatriculation / ✓ Plan de situation / ✓ Lotissement / ✓ PV bornage',
    region: 'Littoral',
    city: 'Douala',
    neighborhood: 'Dibamba / Missolé 2 PK38',
    sizeM2: 492,
    pricePerM2: 10000,
    totalPrice: 4920000,
    label: 'TFL',
    validated: true,
    titleNumber: null,
  },
  {
    id: '3840e50e-ae7f-4dea-8917-c2439d97c403',
    ref: 'KAM-LANDS_DLA-DIBAMBA_MISSOLE2-PK38_010B',
    num: '010B',
    title: 'Missolé 2 PK38 - Lot B (1 420 m²)',
    slug: 'kam-lands-dla-dibamba-missole2-pk38-010b',
    description:
      "Même zone que le lot A. Voisinage du Lycée de Mbongo et de l'Université en construction. Parc Oriental et futur Port Sec à proximité. Axe N3.\n\nAccès : Route N3, axe PK38\n\nÉtat des documents : ✓ Immatriculation / ✓ Plan de situation / ✓ Lotissement / ✓ PV bornage",
    region: 'Littoral',
    city: 'Douala',
    neighborhood: 'Dibamba / Missolé 2 PK38',
    sizeM2: 1420,
    pricePerM2: 9000,
    totalPrice: 12780000,
    label: 'TFL',
    validated: true,
    titleNumber: null,
  },
  {
    id: 'b4fa3f86-e55a-4bf7-8bbe-4291ba97ad38',
    ref: 'KAM-LANDS_DLA-DIBAMBA_MISSOLE2-PK38_010C',
    num: '010C',
    title: 'Missolé 2 PK38 - Lot C (1 251 m²)',
    slug: 'kam-lands-dla-dibamba-missole2-pk38-010c',
    description:
      "Zone Missolé 2 PK38, voisinage du Lycée de Mbongo et de l'Université en construction. Mitoyen du Parc Oriental de Douala-Dibamba. Futur Port Sec à venir. Axe N3 Douala-Yaoundé. Voirie de lotissement 8m. Lotissement en cours.\n\nAccès : Route N3, axe PK38, voirie 8m\n\nÉtat des documents : ✓ Immatriculation / ✓ Plan de situation / ‒ Lotissement en cours / ✓ PV bornage",
    region: 'Littoral',
    city: 'Douala',
    neighborhood: 'Dibamba / Missolé 2 PK38',
    sizeM2: 1251,
    pricePerM2: 7000,
    totalPrice: 8757000,
    label: 'VEFL',
    validated: true,
    titleNumber: null,
  },
  {
    id: '8dc68c09-3e58-410a-81d8-e679d2eb6e4f',
    ref: 'KAM-LANDS_DLA-DIBAMBA_MBONGO-WOUAKAM_012',
    num: '012',
    title: 'Mbongo - Wouakam - Lotissement en cours',
    slug: 'kam-lands-dla-dibamba-mbongo-wouakam-012',
    description:
      'Zone du Quartier Mbongo (Wouakam). Lycée de Mbongo. Université en construction. Zone commerciale du carrefour Mbongo. Nationale N3 à proximité. Lotissement TF 8046/SM en cours.\n\nAccès : Axe Carrefour Mbongo, voirie Wouakam\n\nÉtat des documents : ✓ Immatriculation / ✓ Plan de situation / ‒ Lotissement en cours / ‒ Bornage',
    region: 'Littoral',
    city: 'Douala',
    neighborhood: 'Dibamba / Quartier Mbongo',
    sizeM2: 800,
    pricePerM2: 11000,
    totalPrice: 8800000,
    label: 'VEFL',
    validated: true,
    titleNumber: null,
  },
  {
    id: 'c1d50273-9235-4814-86f9-713e54ff478f',
    ref: 'KAM-LANDS_DLA-DIBAMBA_KENDECK-PITTIGARE_014',
    num: '014',
    title: 'Kendeck - PITTI-GARE - 7 400 m²',
    slug: 'kam-lands-dla-dibamba-kendeck-pittigare-014',
    description:
      'Zone Industrielle de Kendeck, Zone Entreprises. Axe N3-PITTI-GARE. Mitoyen du Dibamba Beach. Voisinage du terrain VEFL™ Face Château (TF 9078). Carrefour stratégique entre la Nationale N3 et la route de PITTI-GARE. Lotissement en cours.\n\nAccès : Axe N3 - PITTI-GARE\n\nÉtat des documents : ✓ Immatriculation / ‒ Plan de situation / ‒ Lotissement en cours / ‒ Bornage',
    region: 'Littoral',
    city: 'Douala',
    neighborhood: 'Dibamba / Kendeck / PITTI-GARE',
    sizeM2: 7400,
    pricePerM2: 7500,
    totalPrice: 55500000,
    label: 'VEFL',
    validated: true,
    titleNumber: null,
  },
  {
    id: '6f32a47a-ef06-4e4c-8747-129b452f3752',
    ref: 'KAM-LANDS_DLA-DIBAMBA_KENDECK-PITTIGARE_015',
    num: '015',
    title: 'Kendeck - PITTI-GARE - 5 000 m²',
    slug: 'kam-lands-dla-dibamba-kendeck-pittigare-015',
    description:
      "Même zone que le terrain #14 (Kendeck PITTI-GARE). Zone d'Industrie de Kendeck. Axe N3-PITTI-GARE. Mitoyen du Dibamba Beach. Carrefour stratégique. Immatriculation en cours, lotissement à venir.\n\nAccès : Axe N3 - PITTI-GARE\n\nÉtat des documents : ‒ Immatriculation en cours / ‒ Plan de situation / ‒ Lotissement à venir / ‒ Bornage",
    region: 'Littoral',
    city: 'Douala',
    neighborhood: 'Dibamba / Kendeck / PITTI-GARE',
    sizeM2: 5000,
    pricePerM2: 5000,
    totalPrice: 25000000,
    label: 'VEFIL',
    validated: false,
    titleNumber: null,
  },
  {
    id: '7cafd6b4-32b5-4bf7-8b4f-d9c6d7b72625',
    ref: 'KAM-LANDS_YAOUNDE_NKOMETOU-NTOH_019',
    num: '019',
    title: 'Nkométou Ntoh',
    slug: 'kam-lands-yaounde-nkometou-ntoh-019',
    description:
      'Zone habitée de Nkométou. Accès par route existante. Titre foncier loti, lots bornés.\n\nAccès : Via route existante\n\nÉtat des documents : ✓ Immatriculation / ✓ Plan de situation / ✓ Lotissement / ✓ PV bornage',
    region: 'Centre',
    city: 'Yaoundé',
    neighborhood: 'Nkométou',
    sizeM2: 1500,
    pricePerM2: 8500,
    totalPrice: 12750000,
    label: 'TFL',
    validated: true,
    titleNumber: null,
  },
  {
    id: '7f9afb16-099f-4853-818b-d172c18e7754',
    ref: 'KAM-LANDS_YAOUNDE_OBALA-ZONE-INDUSTRIELLE_020',
    num: '020',
    title: 'Obala Zone Industrielle',
    slug: 'kam-lands-yaounde-obala-zone-industrielle-020',
    description:
      'À venir.\n\nAccès : Via route existante\n\nÉtat des documents : ‒ Immatriculation en cours / ‒ Plan de situation / ‒ Lotissement à venir / ‒ Bornage',
    region: 'Centre',
    city: 'Obala',
    neighborhood: null,
    sizeM2: 5000,
    pricePerM2: 5000,
    totalPrice: 25000000,
    label: 'VEFIL',
    validated: false,
    titleNumber: null,
  },
];

/** The five fiches with no usable surface (C16 section 5). Described here, loaded nowhere yet. */
export const CATALOGUE_SITES: readonly CatalogueSite[] = [
  {
    ref: 'KAM-LANDS_YDE_ELLATE-NKOABANG_007',
    num: '007',
    title: 'Éllaté - Mitoyen Nkoabang',
    surfaceText: 'Jusqu’à 15 ha disponibles',
    priceText: '3 500 FCFA / m²',
    pricePerM2: 3500,
    label: 'VEFIL',
  },
  {
    ref: 'KAM-LANDS_YDE-SOA_FEGMINBANG-EMIA_008',
    num: '008',
    title: 'Fegminbang - Zone EMIA, axe SOA-ESSE',
    surfaceText: 'Plus de 3 ha disponibles (lots de 500 m² et 1 000 m²)',
    priceText: '5 000 FCFA / m²',
    pricePerM2: 5000,
    label: 'TFL',
  },
  {
    ref: 'KAM-LANDS_DLA-DIBAMBA_KENDECK-CHATEAU_011',
    num: '011',
    title: 'Kendeck - Face Château - 13 ha 57 a 04 ca',
    surfaceText: 'Plus de 10 ha (13 ha 57 a 04 ca)',
    priceText: '15 000 FCFA / m²',
    pricePerM2: 15000,
    label: 'VEFL',
  },
  {
    ref: 'KAM-LANDS_DLA-DIBAMBA_LOGBADJECK-ZI_016',
    num: '016',
    title: 'Logbadjeck - Zone Industrielle',
    surfaceText: '+ de 25 Ha',
    priceText: '4 000 FCFA / m²',
    pricePerM2: 4000,
    label: 'VEFIL',
  },
  {
    ref: 'KAM-LANDS_EDEA_KOUKOUE-ZI_017',
    num: '017',
    title: 'Koukoué Edéa - Zone Industrielle (à préciser)',
    surfaceText: '(à préciser)',
    priceText: '(à préciser)',
    pricePerM2: null,
    label: 'VEFL',
  },
];

/** 018 Nkométou Pont Neuf: a partner site sold in twelve lots whose surfaces are not yet known. Its own round. */
export const CATALOGUE_DEFERRED = ['018'] as const;
