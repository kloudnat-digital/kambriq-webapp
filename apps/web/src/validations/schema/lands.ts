import { CAMEROON_REGIONS } from '@/constants/country';
import { parseTitleNumber } from '@kambriq/common/lands/title-number';
import * as z from 'zod';
import { phoneRequired } from './phone';

export const CreateLandFormResolver = z.object({
  title: z.string().min(3, { error: 'Title must be at least 3 characters' }),
  description: z.string().min(10, { error: 'Description must be at least 10 characters' }),
  region: z.enum(CAMEROON_REGIONS, { error: 'Select a region' }),
  city: z.string().optional(),
  neighborhood: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  sizeM2: z.number().int().positive({ error: 'Size must be a positive integer' }),
  price: z.number().int().positive({ error: 'Price must be positive' }),
  labelId: z.string().min(1, { error: 'Select a label' }),
  pv: z.number().min(0.1).max(2.0),
  ownerType: z.enum(['KAMBRIQ', 'PARTNER']),
  /**
   * P24 - the shape of a titre foncier, checked by the parser the API uses. A
   * courtesy: the API refuses the same input and is the rule. The message is a
   * key the form translates, so the refusal reads in the person's language.
   */
  titleNumber: z
    .string()
    .optional()
    .refine((v) => !v?.trim() || parseTitleNumber(v) !== null, { error: 'titleNumberInvalid' }),
  isPublished: z.boolean(),
  isVerified: z.boolean(),
});

export const ReserveLandFormResolver = z.object({
  name: z.string().min(3, { error: 'Name must be at least 3 characters' }),
  email: z.email({ error: 'Invalid email address' }),
  phone: phoneRequired(),
});

export type CreateLandFormSchema = z.infer<typeof CreateLandFormResolver>;
export type ReserveLandFormSchema = z.infer<typeof ReserveLandFormResolver>;

export const CREATE_LAND_DEFAULTS: CreateLandFormSchema = {
  title: '',
  description: '',
  region: 'Centre',
  city: '',
  neighborhood: '',
  sizeM2: 0,
  price: 0,
  labelId: '',
  pv: 1.0,
  ownerType: 'KAMBRIQ',
  titleNumber: '',
  isPublished: false,
  isVerified: false,
};

export const RESERVE_LAND_DEFAULTS: ReserveLandFormSchema = {
  name: '',
  email: '',
  phone: '',
};

export const CancelReservationFormResolver = z.object({
  reason: z.string().min(5, { error: 'Reason must be at least 5 characters' }),
});

export type CancelReservationFormSchema = z.infer<typeof CancelReservationFormResolver>;

export const CANCEL_RESERVATION_DEFAULTS: CancelReservationFormSchema = {
  reason: '',
};

export const RejectClientDocumentFormResolver = z.object({
  reason: z.string().min(5, { error: 'Reason must be at least 5 characters' }),
});

export type RejectClientDocumentFormSchema = z.infer<typeof RejectClientDocumentFormResolver>;

export const REJECT_CLIENT_DOCUMENT_DEFAULTS: RejectClientDocumentFormSchema = {
  reason: '',
};
