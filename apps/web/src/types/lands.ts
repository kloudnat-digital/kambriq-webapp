export type LandLabelCode = 'TFL' | 'VEFL' | 'VEFIL';
export type LandOwnerType = 'KAMBRIQ' | 'PARTNER';
export type LandStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'ARCHIVED';
export type LandReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DOCS_RECEIVED'
  | 'PAYMENT_CONFIRMED'
  | 'DOSSIER_STARTED';
export type LandMediaType = 'IMAGE' | 'VIDEO';
export type LandDocumentType = 'TITLE_DEED' | 'SURVEY' | 'PERMIT' | 'RECEIPT' | 'OTHER';

export type ExistingMedia = Land['media'][number];
export interface LandDetailMedia {
  url: string;
  order: number;
  downloadUrl: string;
}

export interface LandMediaFile {
  id: string;
  url: string;
  type: LandMediaType;
}

export interface LandLabel {
  id: string;
  name: string;
  code: LandLabelCode;
}

export interface LandDocument {
  id: string;
  type: LandDocumentType;
  name: string;
  url: string;
  isPrivate: boolean;
}

export interface Land {
  id: string;
  title: string;
  slug: string;
  description?: string;
  region: string;
  city?: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  sizeM2: number;
  price: number;
  label: LandLabel;
  pv: number;
  ownerType: LandOwnerType;
  titleNumber?: string;
  surfaceTitle?: number;
  isPublished: boolean;
  isVerified: boolean;
  status: LandStatus;
  media: { id: string; url: string; type: LandMediaType; downloadUrl: string }[];
  documents?: LandDocument[];
  createdAt: string;
  updatedAt: string;
}

export interface LandReservation {
  id: string;
  landId: string;
  agentUserId: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  status: LandReservationStatus;
  downPaymentAmount: number;
  downPaymentConfirmed: boolean;
  cancelReason?: string;
  createdAt: string;
  currentStep: number;
  land: {
    id: string;
    title: string;
    region: string;
    city?: string | null;
    price: number;
    sizeM2: number;
    status: LandStatus;
    label: { code: LandLabelCode };
  };
}

export interface LandDetailDocument {
  id: string;
  name: string;
  url: string;
}

export interface LandDetail {
  id: string;
  title: string;
  status: string;
  price: number;
  sizeM2: number;
  city?: string;
  region?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  isVerified?: boolean;
  tfNumber?: string;
  pv?: number;
  ownerType?: string;
  neighborhood?: string;
  reservations: Array<{
    agentUserId: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    createdAt: string;
    id: string;
    status: string;
  }>;
  label: { code: LandLabelCode; name?: string };
  media?: LandDetailMedia[];
  features?: string[];
  verifiedAt?: string;
  documents?: LandDetailDocument[];
}

export interface MediaFile {
  id: string;
  file: File;
  type: LandMediaType;
}

export interface DocumentFile {
  id: string;
  file: File;
  docType: LandDocumentType;
  isPrivate: boolean;
}

export interface LandReservationDetail {
  id: string;
  landId: string;
  agentUserId: string;
  clientUserId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  status: LandReservationStatus;
  downPaymentAmount: number;
  downPaymentConfirmed: boolean;
  confirmedBy: string;
  confirmedAt: string;
  documentsReceivedAt?: string;
  documentsReceivedBy?: string;
  remainingPaymentConfirmedAt?: string;
  remainingPaymentConfirmedBy?: string;
  dossierStartedAt?: string;
  dossierStartedBy?: string;
  completedAt?: string;
  completedBy?: string;
  cancelReason?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
  land: LandDetail;
  currentStep: number;
}
