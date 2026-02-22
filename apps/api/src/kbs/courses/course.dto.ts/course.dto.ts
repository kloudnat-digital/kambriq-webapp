import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ----- Course -----
export const createCourseSchema = z.object({
  title: z.string().min(1).max(200),
  isPublished: z.boolean().default(false),
  description: z.string().min(1).max(1000),
  duration: z.number().int().min(1), // duration in minutes
});

export class CreateCourseDto extends createZodDto(createCourseSchema) {}

export const updateCourseSchema = createCourseSchema.partial();
export class UpdateCourseDto extends createZodDto(updateCourseSchema) {}

// ----- Module -----
export const createModuleSchema = z.object({
  courseId: z.cuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  order: z.number().int().min(1),
});
export class CreateModuleDto extends createZodDto(createModuleSchema) {}

export const updateModuleSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(1000).optional(),
  order: z.number().int().min(1).optional(),
});

export class UpdateModuleDto extends createZodDto(updateModuleSchema) {}

export const reorderModulesSchema = z.object({
  courseId: z.cuid(),
  moduleIds: z.array(z.cuid()).min(1),
});

export class ReorderModulesDto extends createZodDto(reorderModulesSchema) {}

// ----- Lesson -----
export const createLessonSchema = z.object({
  moduleId: z.cuid(),
  title: z.string().min(1).max(200),
  contentType: z.enum(['VIDEO', 'PDF', 'HTML', 'TEXT']),
  contentUrl: z.string().min(1),
  duration: z.number().int().min(1),
  order: z.number().int().min(1),
});

export class CreateLessonDto extends createZodDto(createLessonSchema) {}

export const updateLessonSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  contentType: z.enum(['VIDEO', 'PDF', 'HTML', 'TEXT']).optional(),
  contentUrl: z.string().min(1).optional(),
  duration: z.number().int().min(1).optional(),
  order: z.number().int().min(1).optional(),
});

export class UpdateLessonDto extends createZodDto(updateLessonSchema) {}

// ----- Question + Answers (Created Together) -----
const answerSchema = z.object({
  text: z.string().min(1).max(500),
  isCorrect: z.boolean(),
});

export const createQuestionSchema = z
  .object({
    moduleId: z.cuid(),
    text: z.string().min(1).max(1000),
    type: z.enum(['SINGLE', 'MULTIPLE']).optional(),
    answers: z.array(answerSchema).min(2).max(6).optional(),
  })
  .refine((data) => !data.answers || data.answers.some((a) => a.isCorrect), {
    message: 'At least one answer must be marked as correct',
  });

export class CreateQuestionDto extends createZodDto(createQuestionSchema) {}

export const updateQuestionSchema = z
  .object({
    text: z.string().min(1).max(1000).optional(),
    type: z.enum(['SINGLE', 'MULTIPLE']).optional(),
    answers: z.array(answerSchema).min(2).max(6).optional(),
  })
  .refine((data) => !data.answers || data.answers.some((a) => a.isCorrect), {
    message: 'At least one answer must be marked as correct',
  });

export class UpdateQuestionDto extends createZodDto(updateQuestionSchema) {}

// ----- Upload URL Request -----
export const uploadUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  moduleId: z.cuid().optional(),
  lessonId: z.cuid().optional(),
});

export class GetUploadUrlDto extends createZodDto(uploadUrlSchema) {}
