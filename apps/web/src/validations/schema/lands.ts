import { CAMEROON_REGIONS } from '@/constants/country';
import * as z from 'zod';

export const LandFormResolver = z.object({
  title: z.string().min(3, { error: 'Title must be at least 3 characters' }),
  description: z.string().min(10, { error: 'Description must be at least 10 characters' }),
  region: z.enum(CAMEROON_REGIONS, { error: 'Select a region' }),
  city: z.string().optional(),
  neighborhood: z.string().optional(),
  sizeM2: z.number().int().positive({ error: 'Size must be a positive integer' }),
  price: z.number().int().positive({ error: 'Price must be positive' }),
  labelId: z.string().min(1, { error: 'Select a label' }),
  pv: z.number().min(0.1).max(2.0),
  ownerType: z.enum(['KAMBRIQ', 'PARTNER']),
  titleNumber: z.string().optional(),
  isPublished: z.boolean(),
  isVerified: z.boolean(),
});

export type LandFormSchema = z.infer<typeof LandFormResolver>;
