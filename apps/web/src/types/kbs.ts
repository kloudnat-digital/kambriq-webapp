export type KbsCandidateStatus =
  | 'CANDIDATE'
  | 'IN_TRAINING'
  | 'EXAM_PENDING'
  | 'CERTIFIED'
  | 'FAILED';

import type { KbsLessonContentType } from '@kambriq/common/constants/kbs/lesson-content';

/**
 * Re-exporting KbsLessonContentType from common library to maintain backwards compatibility
 * with existing web imports.
 */
export type { KbsLessonContentType };

export type KbsModuleStatus = 'locked' | 'in_progress' | 'completed';

export type KbsQuestionType = 'SINGLE' | 'MULTIPLE';

export type KbsExamStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'PASSED'
  | 'FAILED'
  | 'CANCELLED';

export type KbsNextAction = 'lesson' | 'mcq' | 'exam' | 'certified';

// ---- Candidate ----

export type MyCandidate = {
  id: string;
  status: KbsCandidateStatus;
  sponsorCode: string | null;
  enrolledAt: string;
  certifiedAt: string | null;
  currentCycle: number;
};

export type OverviewModule = {
  id: string;
  order: number;
  title: string;
  lessonsCount: number;
  status: KbsModuleStatus;
  lessonsCompleted: number;
  currentLessonOrder: number | null;
  quiz: {
    unlocked: boolean;
    attempts: number;
    score: number | null;
    passed: boolean;
  };
};

export type OverviewPayload = {
  candidate: MyCandidate;
  course: {
    id: string;
    title: string;
    totalModules: number;
  } | null;
  overall: {
    percent: number;
    modulesDone: number;
    modulesTotal: number;
    currentModuleOrder: number | null;
    nextAction: KbsNextAction;
  };
  modules: OverviewModule[];
};

export type LessonNav = {
  id: string;
  order: number;
  title: string;
} | null;

export type LessonView = {
  id: string;
  moduleId: string;
  moduleOrder: number;
  moduleTitle: string;
  order: number;
  title: string;
  contentType: KbsLessonContentType;
  duration: number;
  contentUrl: string | null;
  content: string | null;
  completedAt: string | null;
  navigation: {
    prev: LessonNav;
    next: LessonNav;
  };
};

export type ModuleDetail = {
  module: {
    id: string;
    order: number;
    title: string;
    description: string;
  };
  lessons: Array<{
    id: string;
    order: number;
    title: string;
    duration: number;
    contentType: KbsLessonContentType;
    completedAt: string | null;
  }>;
  quiz: {
    unlocked: boolean;
    attempts: number;
    maxAttempts: number;
    cooldownMinutes: number;
    nextAttemptAt: string | null;
    score: number | null;
    passed: boolean;
    questionCount: number;
  };
};

export type QuizQuestion = {
  id: string;
  text: string;
  type: KbsQuestionType;
  answers: Array<{ id: string; text: string }>;
};

export type QuizView = {
  moduleId: string;
  moduleOrder: number;
  moduleTitle: string;
  passingScore: number;
  attempts: number;
  maxAttempts: number;
  questions: QuizQuestion[];
};

export type QuizResult = {
  score: number;
  passed: boolean;
  passingScore: number;
  correctCount: number;
  totalCount: number;
};

// ---- Exam ----

export type ExamEligibility = {
  eligible: boolean;
  reason: string | null;
  nextAttemptAt: string | null;
  attemptsUsed: number;
  attemptsLeft: number;
  maxAttempts: number;
  cooldownDays: number;
  activeExamId: string | null;
};

export type ExamSummary = {
  id: string;
  status: KbsExamStatus;
  attemptNumber: number;
  passingScore: number;
  scheduledAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  durationMinutes: number;
  totalQuestions: number;
  score: number | null;
};

export type ExamQuestion = {
  id: string;
  text: string;
  type: KbsQuestionType;
  answers: Array<{ id: string; text: string }>;
};

export type ExamRunning = {
  examId: string;
  durationMinutes: number;
  totalQuestions: number;
  startedAt: string;
  expiresAt: string;
  questions: ExamQuestion[];
};

export type ExamResult = ExamSummary & {
  correctCount: number;
  incorrectCount: number;
  answers: Array<{
    questionId: string;
    text: string;
    selectedAnswerIds: string[];
    correctAnswerIds: string[];
    isCorrect: boolean;
  }>;
};

export type ExamHistoryItem = {
  id: string;
  attemptNumber: number;
  status: KbsExamStatus;
  score: number | null;
  scheduledAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
};

// ---- Certificate ----

export type MyCertificate = {
  id: string;
  kcaNumber: string;
  issueDate: string;
  validUntil: string;
  pdfUrl: string | null;
  candidate: {
    firstName: string;
    lastName: string;
  };
  finalScore: number | null;
  modulesCompleted: number;
  modulesTotal: number;
  revokedAt: string | null;
};

// ---- Admin ----

export type AdminCandidateRow = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  status: KbsCandidateStatus;
  sponsorCode: string | null;
  enrolledAt: string;
  certifiedAt: string | null;
  idVerificationStatus: string;
};

/**
 * Represents a row in the activation queue for candidates who have not yet started.
 * The `waitingDays` field indicates how long the candidate has been in the queue.
 */
export type PendingCandidateRow = {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  sponsorCode: string | null;
  enrolledAt: string;
  waitingDays: number;
};

export type AdminCandidateDetail = AdminCandidateRow & {
  phone: string | null;
  cvUrl: string | null;
  idDocumentUrls: string[];
  engagementAcceptedAt: string;
  currentCycle: number;
  maxAttempts: number;
  retakeCooldownDays: number;
  progress: Array<{
    moduleId: string;
    moduleOrder: number;
    moduleTitle: string;
    passed: boolean;
    score: number | null;
    attempts: number;
  }>;
  exams: Array<{
    id: string;
    attemptNumber: number;
    status: KbsExamStatus;
    score: number | null;
    scheduledAt: string | null;
    submittedAt: string | null;
  }>;
  certificate: MyCertificate | null;
};

export type AdminCourse = {
  id: string;
  title: string;
  description: string;
  slug: string | null;
  language: string | null;
  isPublished: boolean;
  duration: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminModule = {
  id: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  lessonsCount: number;
  questionsCount: number;
  examQuestionsCount: number;
};

export type AdminLesson = {
  id: string;
  moduleId: string;
  title: string;
  order: number;
  duration: number;
  contentType: KbsLessonContentType;
  contentUrl: string | null;
  content: string | null;
};

export type AdminCourseDetail = AdminCourse & {
  modules: Array<AdminModule & { lessons: AdminLesson[] }>;
};

export type AdminQuestion = {
  id: string;
  moduleId: string;
  text: string;
  type: KbsQuestionType;
  answers: Array<{ id: string; text: string; isCorrect: boolean }>;
};

export type AdminExamRow = {
  id: string;
  candidateId: string;
  candidateName: string;
  attemptNumber: number;
  status: KbsExamStatus;
  score: number | null;
  scheduledAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
};

export type AdminCertificate = {
  id: string;
  kcaNumber: string;
  issueDate: string;
  validUntil: string;
  revokedAt: string | null;
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

export type AdminSettings = {
  examQuestionCount: number;
  quizQuestionCount: number;
  quizMaxAttempts: number;
  quizCooldownMinutes: number;
  activeCourseId: string | null;
};

// ---- Upload ----

export type PresignedUpload = {
  uploadUrl: string;
  fileUrl: string;
};
