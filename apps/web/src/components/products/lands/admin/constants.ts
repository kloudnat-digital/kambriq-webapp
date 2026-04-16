export const LAND_STATUS_STYLES: Record<string, string> = {
  AVAILABLE: 'border-success/30 bg-success/10 text-success',
  RESERVED: 'border-amber-300 bg-amber-50 text-amber-700',
  SOLD: 'border-blue-300 bg-blue-50 text-blue-700',
  ARCHIVED: 'border-gray-300 bg-gray-100 text-gray-500',
};

export const RESERVATION_STATUS_STYLES: Record<string, string> = {
  PENDING: 'border-amber-300 bg-amber-50 text-amber-700',
  CONFIRMED: 'border-blue-300 bg-blue-50 text-blue-700',
  COMPLETED: 'border-success/30 bg-success/10 text-success',
  CANCELLED: 'border-red-300 bg-red-50 text-red-700',
};

export const LABEL_STYLES: Record<string, string> = {
  TDT: 'bg-primary-500/10 text-primary-700 border-primary-500/30',
  VEFL: 'bg-gold-500/10 text-gold-700 border-gold-500/30',
  VEFIL: 'bg-accent-500/10 text-accent-700 border-accent-500/30',
};
