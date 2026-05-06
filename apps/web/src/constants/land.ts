import type { LandLabelCode, LandReservationStatus, LandStatus } from '@/types/lands';

export type StatusOption = { value: string; label: string };
export type StatusOptionKey = { value: string; labelKey: string };

export const LAND_LABEL_CODES: LandLabelCode[] = ['TFL', 'VEFL', 'VEFIL'];

export const LAND_STATUS_OPTION_KEYS: StatusOptionKey[] = [
  { value: '', labelKey: 'statusAll' },
  { value: 'AVAILABLE', labelKey: 'statusAvailable' },
  { value: 'RESERVED', labelKey: 'statusReserved' },
  { value: 'SOLD', labelKey: 'statusSold' },
  { value: 'ARCHIVED', labelKey: 'statusArchived' },
];

export const AGENT_LAND_STATUS_OPTION_KEYS: StatusOptionKey[] = LAND_STATUS_OPTION_KEYS.slice(0, 3);

export const LAND_RESERVATION_STATUS_OPTION_KEYS: StatusOptionKey[] = [
  { value: '', labelKey: 'statusAll' },
  { value: 'PENDING', labelKey: 'statusPending' },
  { value: 'CONFIRMED', labelKey: 'statusConfirmed' },
  { value: 'DOCS_RECEIVED', labelKey: 'statusDocsReceived' },
  { value: 'PAYMENT_CONFIRMED', labelKey: 'statusPaymentConfirmed' },
  { value: 'DOSSIER_STARTED', labelKey: 'statusDossierStarted' },
  { value: 'COMPLETED', labelKey: 'statusCompleted' },
  { value: 'CANCELLED', labelKey: 'statusCancelled' },
];

export const LAND_RESERVATION_STATUS_STYLES: Record<LandReservationStatus, string> = {
  PENDING: 'border-amber-300 bg-amber-50 text-amber-700',
  CONFIRMED: 'border-blue-300 bg-blue-50 text-blue-700',
  COMPLETED: 'border-success/30 bg-success/10 text-success',
  CANCELLED: 'border-red-300 bg-red-50 text-red-700',
  DOCS_RECEIVED: 'border-purple-300 bg-purple-50 text-purple-700',
  PAYMENT_CONFIRMED: 'border-indigo-300 bg-indigo-50 text-indigo-700',
  DOSSIER_STARTED: 'border-orange-300 bg-orange-50 text-orange-700',
};

export const LAND_RESERVATION_STATUS_LABEL_KEYS: Record<LandReservationStatus, string> = {
  PENDING: 'statusPending',
  CONFIRMED: 'statusConfirmed',
  DOCS_RECEIVED: 'statusDocsReceived',
  PAYMENT_CONFIRMED: 'statusPaymentConfirmed',
  DOSSIER_STARTED: 'statusDossierStarted',
  COMPLETED: 'statusCompleted',
  CANCELLED: 'statusCancelled',
};

export const LAND_RESERVATION_STATUS_STEP: Record<LandReservationStatus, number> = {
  PENDING: 1,
  CONFIRMED: 2,
  DOCS_RECEIVED: 3,
  PAYMENT_CONFIRMED: 4,
  DOSSIER_STARTED: 5,
  COMPLETED: 6,
  CANCELLED: 0,
};

export const LAND_LABEL_CODE_STYLES: Record<LandLabelCode, string> = {
  TFL: 'bg-primary-500/10 text-primary-700 border-primary-500/30',
  VEFL: 'bg-gold-500/10 text-gold-700 border-gold-500/30',
  VEFIL: 'bg-accent-500/10 text-accent-700 border-accent-500/30',
};

export const LAND_STATUS_STYLES: Record<LandStatus, string> = {
  AVAILABLE: 'bg-green-100 text-green-700',
  RESERVED: 'bg-orange-100 text-orange-700',
  SOLD: 'bg-gray-100 text-gray-500',
  ARCHIVED: 'bg-gray-100 text-gray-400',
};

export const LAND_STATUS_LABELS: Record<LandStatus, string> = {
  AVAILABLE: 'Disponible',
  RESERVED: 'Réservé',
  SOLD: 'Vendu',
  ARCHIVED: 'Archivé',
};
