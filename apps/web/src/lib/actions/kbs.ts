'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError, serverApi } from '@/lib/api/server';
import { type CertificateVerdict, toCertificateVerdict } from '@/lib/certificate-verdict';
import { logger } from '@/lib/logger';
import { createAction, ServerActionError } from './create-action';
import type {
  AdminCandidateDetail,
  AdminCandidateRow,
  AdminCertificate,
  AdminCourse,
  AdminCourseDetail,
  AdminExamRow,
  AdminLesson,
  AdminModule,
  AdminQuestion,
  AdminSettings,
  ExamEligibility,
  ExamHistoryItem,
  ExamResult,
  ExamRunning,
  ExamSummary,
  KbsLessonContentType,
  KbsQuestionType,
  LessonView,
  ModuleDetail,
  MyCandidate,
  MyCertificate,
  OverviewPayload,
  PendingCandidateRow,
  PresignedUpload,
  QuizResult,
  QuizView,
} from '@/types/kbs';
import type { PaginatedResponse } from '@/types/api';

const nullOn404 = async <T>(fn: () => Promise<T>): Promise<T | null> => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
};

// ==== Public ====

/**
 * The verdict `/verify-certificate` shows a stranger. Anonymous, so it goes
 * through `api`, not `serverApi`: a visitor with an expired session must get an
 * answer, not a redirect to a login page.
 *
 * It never throws and never guesses. An API that could not be reached, or that
 * answered with anything but a clean verdict, is `unavailable` - "we cannot say
 * right now" - and never a stale or assumed `valid`. A 404 is read as unknown
 * because the controller's contract once declared one, although the service
 * answers 200 with `status: 'UNKNOWN'`.
 */
export const verifyCertificate = createAction(
  async (kcaNumber: string): Promise<CertificateVerdict> => {
    try {
      const body = await api.get<unknown>(`/kbs/public/verify/${encodeURIComponent(kcaNumber)}`);
      return toCertificateVerdict(kcaNumber, body);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return { kind: 'unknown' };
      logger.error('CertificateVerificationUnavailable', {
        status: error instanceof ApiError ? error.status : undefined,
        error: error instanceof Error ? error.message : String(error),
      });
      return { kind: 'unavailable' };
    }
  },
);

// ==== Candidate ====

export const getMyCandidate = createAction(async () => {
  return nullOn404(() => serverApi.get<MyCandidate>('/kbs/me'));
});

export const getMyOverview = createAction(async () => {
  return serverApi.get<OverviewPayload>('/kbs/me/overview');
});

export const getModuleDetail = createAction(async (moduleId: string) => {
  return serverApi.get<ModuleDetail>(`/kbs/modules/${moduleId}/detail`);
});

export const getLessonView = createAction(async (lessonId: string) => {
  return serverApi.get<LessonView>(`/kbs/lessons/${lessonId}/view`);
});

export const completeLesson = createAction(async (lessonId: string, revalidate?: string) => {
  try {
    const result = await serverApi.post(`/kbs/lesson/${lessonId}/complete`);
    if (revalidate) revalidatePath(revalidate);
    return result;
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Lesson completion failed.',
      400,
    );
  }
});

export const getQuiz = createAction(async (moduleId: string) => {
  return serverApi.get<QuizView>(`/kbs/modules/${moduleId}/quiz`);
});

export const submitQuiz = createAction(
  async (
    moduleId: string,
    answers: Array<{ questionId: string; answerIds: string[] }>,
    revalidate?: string,
  ) => {
    try {
      const result = await serverApi.post<QuizResult>(`/kbs/modules/${moduleId}/quiz`, { answers });
      if (revalidate) revalidatePath(revalidate);
      return result;
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Quiz submission failed.',
        400,
      );
    }
  },
);

// ---- Enrollment ----

export const enrollKbs = createAction(
  async (data: { sponsorCode?: string; cvUrl?: string; engagementAccepted: true }) => {
    try {
      return await serverApi.post<MyCandidate>('/kbs/enroll', data);
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Enrollment failed.',
        400,
      );
    }
  },
);

export const getIdUploadUrl = createAction(
  async (data: { filename: string; contentType: string }) => {
    return serverApi.post<PresignedUpload>('/users/me/id-document/upload-url', data);
  },
);

export const submitIdDocuments = createAction(async (idDocumentUrls: string[]) => {
  try {
    return await serverApi.patch('/users/me/id-document', { idDocumentUrls });
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'ID document submission failed.',
      400,
    );
  }
});

export const getCvUploadUrl = createAction(
  async (data: { filename: string; contentType: string }) => {
    return serverApi.post<PresignedUpload>('/kbs/cv/upload-url', data);
  },
);

// ---- Exam ----

export const getExamEligibility = createAction(async () => {
  return serverApi.get<ExamEligibility>('/kbs/exam/eligibility');
});

export const scheduleExam = createAction(async (revalidate?: string) => {
  try {
    const result = await serverApi.post<ExamSummary>('/kbs/exam/schedule');
    if (revalidate) revalidatePath(revalidate);
    return result;
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Exam scheduling failed.',
      400,
    );
  }
});

export const rescheduleExam = createAction(
  async (examId: string, scheduledAt: string, revalidate?: string) => {
    try {
      const result = await serverApi.patch<ExamSummary>(`/kbs/exam/${examId}/reschedule`, {
        scheduledAt,
      });
      if (revalidate) revalidatePath(revalidate);
      return result;
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Exam reschedule failed.',
        400,
      );
    }
  },
);

export const startExam = createAction(async (examId: string) => {
  try {
    return await serverApi.post<ExamRunning>(`/kbs/exam/${examId}/start`);
  } catch (error) {
    throw new ServerActionError(error instanceof Error ? error.message : 'Exam start failed.', 400);
  }
});

export const saveExamAnswer = createAction(
  async (examId: string, questionId: string, answerIds: string[], flagged?: boolean) => {
    return serverApi.post(`/kbs/exam/${examId}/answer`, { questionId, answerIds, flagged });
  },
);

export const submitExam = createAction(
  async (
    examId: string,
    answers: Array<{ questionId: string; answerIds: string[] }>,
    revalidate?: string,
  ) => {
    try {
      const result = await serverApi.post<ExamSummary>(`/kbs/exam/${examId}/submit`, { answers });
      if (revalidate) revalidatePath(revalidate);
      return result;
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Exam submission failed.',
        400,
      );
    }
  },
);

export const getExamResults = createAction(async (examId: string) => {
  return serverApi.get<ExamResult>(`/kbs/exam/${examId}/results`);
});

export const getExamHistory = createAction(async () => {
  return serverApi.get<{
    candidateId: string;
    totalAttempts: number;
    maxAttempts: number;
    history: ExamHistoryItem[];
  }>('/kbs/exam/history');
});

// ---- Certificate ----

export const getMyCertificate = createAction(async () => {
  return nullOn404(() => serverApi.get<MyCertificate>('/kbs/certificate/me'));
});

// ==== Admin ====

export const adminGetCandidates = createAction(
  async (params?: { search?: string; status?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return serverApi.get<PaginatedResponse<AdminCandidateRow>>(
      `/kbs/admin/candidates${qs ? `?${qs}` : ''}`,
    );
  },
);

/**
 * I39 - the activation queue: who is waiting, and how long.
 *
 * The activation itself was never missing. Nothing pointed at the people
 * waiting for it, which is why they waited.
 */
export const adminGetPendingCandidates = createAction(async (page = 1, limit = 20) => {
  return serverApi.get<
    PaginatedResponse<PendingCandidateRow> & { meta: { oldestWaitingDays: number | null } }
  >(`/kbs/admin/candidates/pending?page=${page}&limit=${limit}`);
});

export const adminGetCandidate = createAction(async (id: string) => {
  return serverApi.get<AdminCandidateDetail>(`/kbs/admin/candidates/${id}`);
});

export const adminUpdateCandidateStatus = createAction(
  async (id: string, status: string, revalidate?: string) => {
    try {
      const result = await serverApi.patch(`/kbs/admin/candidates/${id}/status`, { status });
      if (revalidate) revalidatePath(revalidate);
      return result;
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Status update failed.',
        400,
      );
    }
  },
);

export const adminResetAttempts = createAction(async (id: string, revalidate?: string) => {
  try {
    const result = await serverApi.post(`/kbs/admin/candidates/${id}/reset-attempts`);
    if (revalidate) revalidatePath(revalidate);
    return result;
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Reset attempts failed.',
      400,
    );
  }
});

export const adminIssueCertificate = createAction(
  async (candidateId: string, pdfUrl: string | undefined, revalidate?: string) => {
    try {
      const result = await serverApi.post(`/kbs/admin/certificates/${candidateId}`, { pdfUrl });
      if (revalidate) revalidatePath(revalidate);
      return result;
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Certificate issue failed.',
        400,
      );
    }
  },
);

export const adminRevokeCertificate = createAction(
  async (candidateId: string, reason: string, revalidate?: string) => {
    try {
      const result = await serverApi.patch(`/kbs/admin/certificates/${candidateId}/revoke`, {
        reason,
      });
      if (revalidate) revalidatePath(revalidate);
      return result;
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Certificate revoke failed.',
        400,
      );
    }
  },
);

export const adminListCertificates = createAction(
  async (params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return serverApi.get<PaginatedResponse<AdminCertificate>>(
      `/kbs/admin/certificates${q ? `?${q}` : ''}`,
    );
  },
);

// ---- Course / Module / Lesson ----

export const adminListCourses = createAction(async () => {
  return serverApi.get<AdminCourse[]>('/kbs/admin/courses');
});

export const adminGetCourse = createAction(async (id: string) => {
  return serverApi.get<AdminCourseDetail>(`/kbs/admin/courses/${id}`);
});

export const adminCreateCourse = createAction(
  async (data: {
    title: string;
    description: string;
    language?: string;
    duration?: number;
    isPublished?: boolean;
  }) => {
    try {
      return await serverApi.post<AdminCourseDetail>('/kbs/admin/courses', data);
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Course creation failed.',
        400,
      );
    }
  },
);

export const adminUpdateCourse = createAction(
  async (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      language: string;
      duration: number;
      isPublished: boolean;
    }>,
    revalidate?: string,
  ) => {
    try {
      const result = await serverApi.patch<AdminCourseDetail>(`/kbs/admin/courses/${id}`, data);
      if (revalidate) revalidatePath(revalidate);
      return result;
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Course update failed.',
        400,
      );
    }
  },
);

export const adminDeleteCourse = createAction(async (id: string, revalidate?: string) => {
  try {
    const result = await serverApi.delete(`/kbs/admin/courses/${id}`);
    if (revalidate) revalidatePath(revalidate);
    return result;
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Course delete failed.',
      400,
    );
  }
});

export const adminCreateModule = createAction(
  async (
    data: { courseId: string; title: string; description: string; order: number },
    revalidate?: string,
  ) => {
    try {
      const result = await serverApi.post<AdminModule>('/kbs/admin/modules', data);
      if (revalidate) revalidatePath(revalidate);
      return result;
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Module creation failed.',
        400,
      );
    }
  },
);

export const adminUpdateModule = createAction(
  async (
    id: string,
    data: Partial<{ title: string; description: string; order: number }>,
    revalidate?: string,
  ) => {
    try {
      const result = await serverApi.patch<AdminModule>(`/kbs/admin/modules/${id}`, data);
      if (revalidate) revalidatePath(revalidate);
      return result;
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Module update failed.',
        400,
      );
    }
  },
);

export const adminReorderModules = createAction(
  async (orders: Array<{ id: string; order: number }>, revalidate?: string) => {
    try {
      const result = await serverApi.patch('/kbs/admin/modules/reorder', { orders });
      if (revalidate) revalidatePath(revalidate);
      return result;
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Module reorder failed.',
        400,
      );
    }
  },
);

export const adminDeleteModule = createAction(async (id: string, revalidate?: string) => {
  try {
    const result = await serverApi.delete(`/kbs/admin/modules/${id}`);
    if (revalidate) revalidatePath(revalidate);
    return result;
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Module delete failed.',
      400,
    );
  }
});

export const adminGetLessonUploadUrl = createAction(
  async (data: { filename: string; contentType: string }) => {
    return serverApi.post<PresignedUpload>('/kbs/admin/upload-url', data);
  },
);

export const adminCreateLesson = createAction(
  async (
    data: {
      moduleId: string;
      title: string;
      order: number;
      duration: number;
      contentType: KbsLessonContentType;
      contentUrl?: string;
      content?: string;
    },
    revalidate?: string,
  ) => {
    try {
      const result = await serverApi.post<AdminLesson>('/kbs/admin/lessons', data);
      if (revalidate) revalidatePath(revalidate);
      return result;
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Lesson creation failed.',
        400,
      );
    }
  },
);

export const adminUpdateLesson = createAction(
  async (
    id: string,
    data: Partial<{
      title: string;
      order: number;
      duration: number;
      contentType: KbsLessonContentType;
      contentUrl: string;
      content: string;
    }>,
    revalidate?: string,
  ) => {
    try {
      const result = await serverApi.patch<AdminLesson>(`/kbs/admin/lessons/${id}`, data);
      if (revalidate) revalidatePath(revalidate);
      return result;
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Lesson update failed.',
        400,
      );
    }
  },
);

export const adminDeleteLesson = createAction(async (id: string, revalidate?: string) => {
  try {
    const result = await serverApi.delete(`/kbs/admin/lessons/${id}`);
    if (revalidate) revalidatePath(revalidate);
    return result;
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Lesson delete failed.',
      400,
    );
  }
});

// ---- Questions (quiz + exam) ----

export const adminGetQuizQuestions = createAction(async (moduleId: string) => {
  return serverApi.get<AdminQuestion[]>(`/kbs/admin/modules/${moduleId}/questions`);
});

export const adminCreateQuestion = createAction(
  async (
    data: {
      moduleId: string;
      text: string;
      type: KbsQuestionType;
      answers: Array<{ text: string; isCorrect: boolean }>;
    },
    revalidate?: string,
  ) => {
    try {
      const result = await serverApi.post<AdminQuestion>('/kbs/admin/questions', data);
      if (revalidate) revalidatePath(revalidate);
      return result;
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Question creation failed.',
        400,
      );
    }
  },
);

export const adminUpdateQuestion = createAction(
  async (
    id: string,
    data: Partial<{
      text: string;
      type: KbsQuestionType;
      answers: Array<{ id?: string; text: string; isCorrect: boolean }>;
    }>,
    revalidate?: string,
  ) => {
    try {
      const result = await serverApi.patch<AdminQuestion>(`/kbs/admin/questions/${id}`, data);
      if (revalidate) revalidatePath(revalidate);
      return result;
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Question update failed.',
        400,
      );
    }
  },
);

export const adminDeleteQuestion = createAction(async (id: string, revalidate?: string) => {
  try {
    const result = await serverApi.delete(`/kbs/admin/questions/${id}`);
    if (revalidate) revalidatePath(revalidate);
    return result;
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Question delete failed.',
      400,
    );
  }
});

export const adminListExamQuestions = createAction(async () => {
  return serverApi.get<AdminQuestion[]>('/kbs/admin/exam-questions');
});

export const adminCreateExamQuestion = createAction(
  async (
    data: {
      moduleId: string;
      text: string;
      type: KbsQuestionType;
      answers: Array<{ text: string; isCorrect: boolean }>;
    },
    revalidate?: string,
  ) => {
    try {
      const result = await serverApi.post<AdminQuestion>('/kbs/admin/exam-questions', data);
      if (revalidate) revalidatePath(revalidate);
      return result;
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Exam question creation failed.',
        400,
      );
    }
  },
);

export const adminUpdateExamQuestion = createAction(
  async (
    id: string,
    data: Partial<{
      text: string;
      type: KbsQuestionType;
      moduleId: string;
      answers: Array<{ id?: string; text: string; isCorrect: boolean }>;
    }>,
    revalidate?: string,
  ) => {
    try {
      const result = await serverApi.patch<AdminQuestion>(`/kbs/admin/exam-questions/${id}`, data);
      if (revalidate) revalidatePath(revalidate);
      return result;
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Exam question update failed.',
        400,
      );
    }
  },
);

export const adminDeleteExamQuestion = createAction(async (id: string, revalidate?: string) => {
  try {
    const result = await serverApi.delete(`/kbs/admin/exam-questions/${id}`);
    if (revalidate) revalidatePath(revalidate);
    return result;
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Exam question delete failed.',
      400,
    );
  }
});

// ---- Admin exams ----

export const adminListExams = createAction(
  async (params?: { status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return serverApi.get<PaginatedResponse<AdminExamRow>>(`/kbs/admin/exams${q ? `?${q}` : ''}`);
  },
);

export const adminCancelExam = createAction(
  async (examId: string, reason: string, revalidate?: string) => {
    try {
      const result = await serverApi.patch(`/kbs/admin/exams/${examId}/cancel`, { reason });
      if (revalidate) revalidatePath(revalidate);
      return result;
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Exam cancel failed.',
        400,
      );
    }
  },
);

// ---- Settings ----

export const adminGetSettings = createAction(async () => {
  return serverApi.get<AdminSettings>('/kbs/admin/settings');
});

export const adminUpdateSettings = createAction(
  async (data: Partial<AdminSettings>, revalidate?: string) => {
    try {
      const result = await serverApi.patch<AdminSettings>('/kbs/admin/settings', data);
      if (revalidate) revalidatePath(revalidate);
      return result;
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Settings update failed.',
        400,
      );
    }
  },
);
