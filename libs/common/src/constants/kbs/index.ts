export * from './lesson-content';
export * from './lesson-media';

/**
 * Assessment passing thresholds.
 * `EXAM_PASSING_SCORE` applies to new schedules; grading relies on snapshots to immunize past results from threshold changes.
 */
export const MODULE_PASSING_SCORE = 70 as const;
export const EXAM_PASSING_SCORE = 80 as const;
export const DEFAULT_EXAM_QUESTION_COUNT = 20 as const;
export const DEFAULT_QUIZ_QUESTION_COUNT = 10 as const;

/**
 * Candidate lifecycle stages.
 * `CERTIFIED` requires manual certificate issuance; `EXAM_PASSED` triggers automatically on grading.
 */
export const enum CandidateStatus {
  CANDIDATE = 'CANDIDATE',
  IN_TRAINING = 'IN_TRAINING',
  EXAM_PENDING = 'EXAM_PENDING',
  EXAM_PASSED = 'EXAM_PASSED',
  CERTIFIED = 'CERTIFIED',
  FAILED = 'FAILED',
}
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  [CandidateStatus.CANDIDATE]: [CandidateStatus.IN_TRAINING],
  [CandidateStatus.IN_TRAINING]: [CandidateStatus.EXAM_PENDING],
  [CandidateStatus.EXAM_PENDING]: [CandidateStatus.EXAM_PASSED, CandidateStatus.FAILED],
  // CERTIFIED requires explicit certificate issuance.
  [CandidateStatus.EXAM_PASSED]: [],
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
  'CANDIDATE',
  'IN_TRAINING',
  'EXAM_PENDING',
  'EXAM_PASSED',
  'CERTIFIED',
  'FAILED',
] as const;
