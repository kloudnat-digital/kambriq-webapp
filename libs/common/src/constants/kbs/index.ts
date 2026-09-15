export const MODULE_PASSING_SCORE = 70 as const;
export const EXAM_PASSING_SCORE = 75 as const;
export const DEFAULT_EXAM_QUESTION_COUNT = 20 as const;
export const DEFAULT_QUIZ_QUESTION_COUNT = 10 as const;

/**
 * One status, one meaning.
 *
 * `CERTIFIED` used to be set by grading, so a candidate was certified the moment
 * they passed - before any certificate existed, and before any human had stood
 * behind it. `GET /kbs/certificate/me` answered `{"data":null}` to somebody the
 * API called certified, and `isCertified()` already carried a patch for it:
 * "if no certificate has been issued yet the status alone is not enough".
 * A status that needs a second check to be believed is not a status.
 *
 * `EXAM_PASSED` is what passing an exam earns. `CERTIFIED` is what issuing a
 * certificate confers. Issuance stays a deliberate admin act - the model has an
 * `issuedBy` column and a revoke path with a mandatory reason, which is what a
 * document somebody stands behind looks like.
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
  // I15 - nothing: CERTIFIED is reached only by issuing the certificate
  // (`KbsCertificatesService.issueCertificate`), never by a status change.
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
