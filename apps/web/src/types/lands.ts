export type LandLabelCode = 'TDT' | 'VEFL' | 'VEFIL';
export type LandOwnerType = 'KAMBRIQ' | 'PARTNER';
export type LandStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'ARCHIVED';
export type LandReservationStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
export type LandMediaType = 'IMAGE' | 'VIDEO';

export interface LandMediaFile {
  id: string;
  url: string;
  type: LandMediaType;
}

export interface LandLabel {
  id: string;
  code: LandLabelCode;
  name: string;
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
  media: { id: string; url: string; type: LandMediaType }[];
  createdAt: string;
  updatedAt: string;
}

export interface LandReservation {
  id: string;
  land: { id: string; title: string; region: string; city?: string };
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  agent: { id: string; name: string };
  depositAmount: number;
  downPaymentConfirmed: boolean;
  status: LandReservationStatus;
  reason?: string;
  createdAt: string;
}

export type MediaFile = {
  id: string;
  file: File;
  type: LandMediaType;
};

export type ExistingMedia = Land['media'][number];
