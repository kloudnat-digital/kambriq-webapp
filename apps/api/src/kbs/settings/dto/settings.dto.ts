import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateSettingsSchema = z.object({
  activeCourseId: z.string().uuid('Must be a valid UUID').nullable().optional(),
  examQuestionCount: z.number().int().min(1).max(200).optional(),
  quizQuestionCount: z.number().int().min(1).max(100).optional(),
  quizMaxAttempts: z.number().int().min(0, 'Use 0 for unlimited attempts').max(50).optional(),
  quizCooldownMinutes: z.number().int().min(0).max(1440).optional(),
});

export class UpdateSettingsDto extends createZodDto(updateSettingsSchema) {}
