import type { LandLabel, LandLabelCode, LandReservationStatus, LandStatus } from '@/types/lands';
import type { LandFormSchema } from '@/validations/schema/lands';

export const LAND_STATUS_STYLES: Record<LandStatus, string> = {
  AVAILABLE: 'border-success/30 bg-success/10 text-success',
  RESERVED: 'border-amber-300 bg-amber-50 text-amber-700',
  SOLD: 'border-blue-300 bg-blue-50 text-blue-700',
  ARCHIVED: 'border-gray-300 bg-gray-100 text-gray-500',
};

export const RESERVATION_STATUS_STYLES: Record<LandReservationStatus, string> = {
  PENDING: 'border-amber-300 bg-amber-50 text-amber-700',
  CONFIRMED: 'border-blue-300 bg-blue-50 text-blue-700',
  COMPLETED: 'border-success/30 bg-success/10 text-success',
  CANCELLED: 'border-red-300 bg-red-50 text-red-700',
};

export const LABEL_STYLES: Record<LandLabelCode, string> = {
  TDT: 'bg-primary-500/10 text-primary-700 border-primary-500/30',
  VEFL: 'bg-gold-500/10 text-gold-700 border-gold-500/30',
  VEFIL: 'bg-accent-500/10 text-accent-700 border-accent-500/30',
};

export const EMPTY_DEFAULTS: LandFormSchema = {
  title: '',
  description: '',
  region: 'Centre',
  city: '',
  neighborhood: '',
  sizeM2: 0,
  price: 0,
  labelId: '',
  pv: 1.0,
  ownerType: 'KAMBRIQ',
  titleNumber: '',
  isPublished: false,
  isVerified: false,
};

export const LAND_LABELS: LandLabel[] = [
  { id: 'tdt', code: 'TDT', name: 'Terrains Déjà Titrés' },
  { id: 'vefl', code: 'VEFL', name: 'Vente en État Futur de Lotissement' },
  { id: 'vefil', code: 'VEFIL', name: "Vente en État Futur d'Immatriculation et de Lotissement" },
];
