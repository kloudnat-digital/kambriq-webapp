import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const SubscribeNewsletterSchema = z.object({
  email: z.email('Invalid email address'),
});

export class SubscribeNewsletterDto extends createZodDto(SubscribeNewsletterSchema) {}
