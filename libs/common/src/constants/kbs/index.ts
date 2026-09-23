export * from './lesson-content';
export * from './lesson-media';

/**
 * Passing thresholds for different assessment types.
 *
 * Note: `EXAM_PASSING_SCORE` applies to newly scheduled exams. The grading logic
 * relies on the snapshot `passingScore` stored on the exam record itself,
 * ensuring past results remain unaffected by future threshold changes.
 */
export const MODULE_PASSING_SCORE = 70 as const;
export const EXAM_PASSING_SCORE = 80 as const;
export const DEFAULT_EXAM_QUESTION_COUNT = 20 as const;
export const DEFAULT_QUIZ_QUESTION_COUNT = 10 as const;

/**
 * Represents the lifecycle stages of a candidate.
 * Note: `CERTIFIED` requires an explicit administrative action to issue a certificate,
 * whereas `EXAM_PASSED` is granted automatically upon successful grading.
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
  // CERTIFIED is reached only via explicit certificate issuance, not via a generic status transition.
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
