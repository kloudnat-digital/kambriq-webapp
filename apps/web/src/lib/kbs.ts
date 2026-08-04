import type { KbsCandidateStatus, KbsExamStatus, KbsModuleStatus } from '@/types/kbs';

export const KBS_STATUS_TONE: Record<KbsCandidateStatus, string> = {
  CANDIDATE: 'bg-gray-100 text-gray-700',
  IN_TRAINING: 'bg-blue-100 text-blue-800',
  EXAM_PENDING: 'bg-amber-100 text-amber-800',
  CERTIFIED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-800',
};

export const KBS_MODULE_TONE: Record<KbsModuleStatus, string> = {
  locked: 'bg-gray-100 text-gray-500',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-emerald-100 text-emerald-800',
};

export const KBS_EXAM_TONE: Record<KbsExamStatus, string> = {
  SCHEDULED: 'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  SUBMITTED: 'bg-indigo-100 text-indigo-800',
  PASSED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

export const formatDate = (iso: string | null | undefined, locale = 'fr-FR'): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
};

export const formatDateTime = (iso: string | null | undefined, locale = 'fr-FR'): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};
