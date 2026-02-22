export const MODULE_PASSING_SCORE = 70 as const;
export const EXAM_PASSING_SCORE = 75 as const;
export const DEFAULT_EXAM_QUESTION_COUNT = 20 as const;
export const DEFAULT_QUIZ_QUESTION_COUNT = 10 as const;

export const enum CandidateStatus {
  CANDIDATE = 'CANDIDATE',
  IN_TRAINING = 'IN_TRAINING',
  EXAM_PENDING = 'EXAM_PENDING',
  CERTIFIED = 'CERTIFIED',
  FAILED = 'FAILED',
}
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  [CandidateStatus.CANDIDATE]: [CandidateStatus.IN_TRAINING],
  [CandidateStatus.IN_TRAINING]: [CandidateStatus.EXAM_PENDING],
  [CandidateStatus.EXAM_PENDING]: [
    CandidateStatus.CERTIFIED,
    CandidateStatus.FAILED,
  ],
  [CandidateStatus.FAILED]: [CandidateStatus.EXAM_PENDING],
  [CandidateStatus.CERTIFIED]: [],
} as const;

export const enum ExamStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}
export const VALID_STATUSES = [
  'ENROLLED',
  'IN_TRAINING',
  'EXAM_PENDING',
  'CERTIFIED',
  'FAILED',
] as const;
