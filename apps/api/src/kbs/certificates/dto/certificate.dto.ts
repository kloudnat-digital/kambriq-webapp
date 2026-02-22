import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// ----- Admin: Issue Certificate (candidateId from URL param) -----
export const issueCertificateSchema = z.object({
  pdfUrl: z.url().optional(),
});
export class IssueCertificateDto extends createZodDto(issueCertificateSchema) {}
