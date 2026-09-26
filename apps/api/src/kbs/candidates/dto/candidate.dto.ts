import { VALID_STATUSES } from '@kambriq/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ----- Enrollment ---------
export const enrollSchema = z.object({
  sponsorCode: z.string().optional(),
  cvUrl: z.string().min(1).max(300).optional(), // A52: a storage key; KbsCandidatesService.enroll decides whose
  engagementAccepted: z.literal(true, {
    error: 'You must accept the KBS engagement',
  }),
});

export class EnrollDto extends createZodDto(enrollSchema) {}

// ----- CV document upload URL -----
export const cvUploadUrlSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  contentType: z.string().min(1, 'Content type is required'),
});

export class CvUploadUrlDto extends createZodDto(cvUploadUrlSchema) {}

// ----- Module Quiz Submission ---------
const quizAnswerSchema = z.object({
  questionId: z.uuid(),
  answerIds: z.array(z.uuid()).min(1), // SINGLE: 1 element; MULTIPLE: ≥1 elements
});

// I21 - one question id per answer: ten answers to one question graded as ten.
export const submitQuizSchema = z.object({
  answers: z
    .array(quizAnswerSchema)
    .min(1)
    .refine((answers) => new Set(answers.map((a) => a.questionId)).size === answers.length, {
      message: 'Each question may be answered only once.',
    }),
});

export class SubmitQuizDto extends createZodDto(submitQuizSchema) {}

// ----- Update Candidate Status ---------
export const updateCandidateStatusSchema = z.object({
  status: z.enum(VALID_STATUSES),
});

export class UpdateCandidateStatusDto extends createZodDto(updateCandidateStatusSchema) {}

// ----- Candidate list filters ---------
export const candidateFilterSchema = z.object({
  status: z.enum(VALID_STATUSES).optional(),
  search: z.string().optional(),
});

export class CandidateFilterDto extends createZodDto(candidateFilterSchema) {}
