import { createZodDto } from 'nestjs-zod';
import {
  LESSON_CONTENT_TYPES,
  isFileBackedContentType,
  type KbsLessonContentType,
} from '@kambriq/common/constants/kbs/lesson-content';
import { z } from 'zod';

// ----- Course -----
export const createCourseSchema = z.object({
  title: z.string().min(1).max(200),
  isPublished: z.boolean().default(false),
  description: z.string().min(1).max(1000),
  duration: z.number().int().optional(), // duration in minutes
});

export class CreateCourseDto extends createZodDto(createCourseSchema) {}

export const updateCourseSchema = createCourseSchema.partial();
export class UpdateCourseDto extends createZodDto(updateCourseSchema) {}

// ----- Module -----
export const createModuleSchema = z.object({
  courseId: z.uuid(),
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
  courseId: z.uuid(),
  moduleIds: z.array(z.uuid()).min(1),
});

export class ReorderModulesDto extends createZodDto(reorderModulesSchema) {}

// ----- Lesson -----
// A4: the values and the file-backed rule come from `libs/common`, which is the
// only place either is written. They used to be declared here as well, and the
// second copy is what let the seed drift to lower case unnoticed.
const isFileBacked = (t: KbsLessonContentType) => isFileBackedContentType(t);

export const createLessonSchema = z
  .object({
    moduleId: z.uuid(),
    title: z.string().min(1).max(200),
    contentType: z.enum(LESSON_CONTENT_TYPES),
    contentUrl: z.string().min(1).optional(),
    content: z.string().min(1).optional(),
    duration: z.number().int().min(1),
    order: z.number().int().min(1),
  })
  .refine((d) => (isFileBacked(d.contentType) ? !!d.contentUrl : !!d.content), {
    message: 'contentUrl is required for VIDEO/PDF, content is required for HTML/TEXT',
    path: ['contentUrl'],
  });

export class CreateLessonDto extends createZodDto(createLessonSchema) {}

export const updateLessonSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    contentType: z.enum(LESSON_CONTENT_TYPES).optional(),
    contentUrl: z.string().min(1).optional(),
    content: z.string().min(1).optional(),
    duration: z.number().int().min(1).optional(),
    order: z.number().int().min(1).optional(),
  })
  .refine(
    (d) =>
      d.contentType === undefined ||
      (isFileBacked(d.contentType) ? d.contentUrl !== undefined : d.content !== undefined),
    {
      message: 'contentUrl is required for VIDEO/PDF, content is required for HTML/TEXT',
      path: ['contentUrl'],
    },
  );

export class UpdateLessonDto extends createZodDto(updateLessonSchema) {}

// ----- Question + Answers (Created Together) -----
const answerSchema = z.object({
  text: z.string().min(1).max(500),
  isCorrect: z.boolean(),
});

export const createQuestionSchema = z
  .object({
    moduleId: z.uuid(),
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
  filename: z.string().min(1),
  contentType: z.string().min(1),
  moduleId: z.uuid().optional(),
  lessonId: z.uuid().optional(),
});

// A15. See GetLandUploadUrlDto in lands: both were GetUploadUrlDto and collided
// in the OpenAPI. Distinct contracts - this one carries moduleId/lessonId, the
// land one a media category - so they are named apart, not merged.
export class GetCourseUploadUrlDto extends createZodDto(uploadUrlSchema) {}
