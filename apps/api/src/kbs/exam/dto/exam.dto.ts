import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// ----- Save single answer (auto-save during exam) -----
export const saveAnswerSchema = z.object({
  questionId: z.uuid(),
  answerIds: z.array(z.uuid()).default([]), // empty = unanswered; SINGLE expects 1 element, MULTIPLE expects ≥1
  flagged: z.boolean().default(false).optional(), // for "mark for review" feature
});

export class SaveAnswerDto extends createZodDto(saveAnswerSchema) {}

// ----- Submit exam (for grading) -----
const examAnswerSchema = z.object({
  questionId: z.uuid(),
  answerIds: z.array(z.uuid()).default([]),
});

// I21 - one question id per answer, as for the module quiz.
export const submitExamSchema = z.object({
  answers: z
    .array(examAnswerSchema)
    .refine((answers) => new Set(answers.map((a) => a.questionId)).size === answers.length, {
      message: 'Each question may be answered only once.',
    }),
});

export class SubmitExamDto extends createZodDto(submitExamSchema) {}

// ----- Admin: Cancel Exam -----
export const cancelExamSchema = z.object({
  reason: z.string().min(1).max(500),
});

export class CancelExamDto extends createZodDto(cancelExamSchema) {}

// ----- Reschedule Exam -----
export const rescheduleExamSchema = z.object({
  scheduledAt: z.iso
    .datetime()
    .transform((s) => new Date(s))
    .refine((date) => date > new Date(), {
      message: 'Scheduled date must be in the future',
    }),
});

export class RescheduleExamDto extends createZodDto(rescheduleExamSchema) {}

// Admin - Exam question CRUD (Dedicated Pool)
const examAnswerInputSchema = z.object({
  text: z.string().min(1).max(1000),
  isCorrect: z.boolean(),
});

export const createExamQuestionSchema = z
  .object({
    text: z.string().min(1).max(2000),
    type: z.enum(['SINGLE', 'MULTIPLE']).default('SINGLE'),
    moduleId: z.uuid(),
    answers: z.array(examAnswerInputSchema).min(2).max(6),
  })
  .refine((data) => data.answers.some((a) => a.isCorrect), {
    message: 'At least one answer must be marked as correct',
  });

export class CreateExamQuestionDto extends createZodDto(createExamQuestionSchema) {}

export const updateExamQuestionSchema = z
  .object({
    text: z.string().min(1).max(2000).optional(),
    type: z.enum(['SINGLE', 'MULTIPLE']).optional(),
    moduleId: z.uuid().optional(),
    answers: z.array(examAnswerInputSchema).min(2).max(6).optional(),
  })
  .refine((data) => !data.answers || data.answers.some((a) => a.isCorrect), {
    message: 'At least one answer must be marked as correct',
  });

export class UpdateExamQuestionDto extends createZodDto(updateExamQuestionSchema) {}
