export type SubDialog = 'prospect' | 'reservation' | 'docs' | 'support' | null;

export const LAND_LABEL_CODE_STYLES: Record<string, string> = {
  TFL: 'bg-primary-500/10 text-primary-700 border-primary-500/30',
  VEFL: 'bg-gold-500/10 text-gold-700 border-gold-500/30',
  VEFIL: 'bg-accent-500/10 text-accent-700 border-accent-500/30',
};

export const DOCS = [
  'modal.verification.docTitle',
  'modal.verification.docVerify',
  'modal.verification.docBordereau',
  'modal.verification.docUrban',
] as const;
