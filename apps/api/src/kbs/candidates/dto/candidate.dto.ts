import { VALID_STATUSES } from '@kambriq/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ----- Enrollment ---------
export const enrollSchema = z.object({
  sponsorCode: z.string().optional(),
});

export class EnrollDto extends createZodDto(enrollSchema) {}

// ----- Module Quiz Submission ---------
const quizAnswerSchema = z.object({
  questionId: z.uuid(),
  answerIds: z.array(z.uuid()).min(1), // SINGLE: 1 element; MULTIPLE: ≥1 elements
});

export const submitQuizSchema = z.object({
  answers: z.array(quizAnswerSchema).min(1),
});

export class SubmitQuizDto extends createZodDto(submitQuizSchema) {}

// ----- Update Candidate Status ---------
export const updateCandidateStatusSchema = z.object({
  status: z.enum(VALID_STATUSES),
});

export class UpdateCandidateStatusDto extends createZodDto(
  updateCandidateStatusSchema,
) {}

// ----- Candidate list filters ---------
export const candidateFilterSchema = z.object({
  status: z.enum(VALID_STATUSES).optional(),
  search: z.string().optional(),
});

export class CandidateFilterDto extends createZodDto(candidateFilterSchema) {}
