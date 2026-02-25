import {
  LandDocumentType,
  LandLabelCodes,
  LandMediaCategory,
  LandMediaType,
  LandOwnerType,
  LandReservationStatus,
  LandStatus,
} from '@kambriq/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ----- Land Labels ----- //

export const createLabelSchema = z.object({
  code: z.enum(LandLabelCodes),
  name: z.string().min(1, 'Label name is required').max(100),
  description: z.string().max(500).optional(),
});

export class CreateLabelDto extends createZodDto(createLabelSchema) {}

export const updateLabelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export class UpdateLabelDto extends createZodDto(updateLabelSchema) {}

// ----- Land Parcels ----- //

export const createLandSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  description: z.string().min(1, 'Description is required'),
  region: z.string().min(1, 'Region is required').max(100),
  city: z.string().max(100).optional(),
  neighborhood: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  sizeM2: z.number().int().positive('Size must be positive'),
  price: z.number().int().positive('Price must be positive'), // In XAF
  labelId: z.uuid('Invalid label ID'),
  pv: z.number().min(0.1).max(2.0).default(1.0), // Point Valeur (commission coefficient)
  ownerType: z.enum(LandOwnerType).default(LandOwnerType.KAMBRIQ),
  partnerId: z.uuid().optional(),
  titleNumber: z.string().max(100).optional(), // Official land title number
  surfaceTitle: z.number().int().positive().optional(), // Surface on title deed
  isPublished: z.boolean().default(false),
  isVerified: z.boolean().default(false),
});

export class CreateLandDto extends createZodDto(createLandSchema) {}

export const updateLandSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().min(1).optional(),
  region: z.string().min(1).max(100).optional(),
  city: z.string().max(100).optional(),
  neighborhood: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  sizeM2: z.number().int().positive().optional(),
  price: z.number().int().positive().optional(), // Triggers price history
  labelId: z.uuid().optional(),
  pv: z.number().min(0.1).max(2.0).optional(),
  ownerType: z.enum(LandOwnerType).optional(),
  partnerId: z.uuid().optional(),
  titleNumber: z.string().max(100).optional(),
  surfaceTitle: z.number().int().positive().optional(),
  isPublished: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  status: z.enum(LandStatus).optional(),
});

export class UpdateLandDto extends createZodDto(updateLandSchema) {}

export const landFilterSchema = z.object({
  region: z.string().optional(),
  city: z.string().optional(),
  labelCode: z.enum(LandLabelCodes).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().positive().optional(),
  status: z.enum(LandStatus).optional(),
  search: z.string().optional(),
});

export class LandFilterDto extends createZodDto(landFilterSchema) {}

// ----- Land Media ----- //

export const addMediaSchema = z.object({
  landId: z.uuid('Invalid land ID'),
  type: z.enum(LandMediaType).default(LandMediaType.IMAGE),
  caption: z.string().max(300).optional(),
  order: z.number().int().min(0).default(0),
  url: z.string().min(1, 'File URL/key is required'),
});

export class AddMediaDto extends createZodDto(addMediaSchema) {}

// ----- Land Documents ----- //

export const addDocumentSchema = z.object({
  landId: z.uuid('Invalid land ID'),
  type: z.enum(LandDocumentType),
  name: z.string().min(1, 'Document name is required').max(300),
  url: z.string().min(1, 'File URL/key is required'),
  isPrivate: z.boolean().default(true),
});

export class AddDocumentDto extends createZodDto(addDocumentSchema) {}

// ----- Land Reservations ----- //

export const createLandReservationSchema = z.object({
  landId: z.uuid('Invalid land ID'),
  clientName: z.string().min(1, 'Client name is required').max(200),
  clientEmail: z.email('Invalid client email'),
  clientPhone: z.string().max(30),
});

export class CreateLandReservationDto extends createZodDto(
  createLandReservationSchema,
) {}

export const cancelLandReservationSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required').max(1000),
});

export class CancelLandReservationDto extends createZodDto(
  cancelLandReservationSchema,
) {}

export const landReservationFilterSchema = z.object({
  status: z.enum(LandReservationStatus).optional(),
  agentUserId: z.uuid().optional(),
  search: z.string().optional(),
});

export class LandReservationFilterDto extends createZodDto(
  landReservationFilterSchema,
) {}

// ----- Land Upload URL ----- //

export const getUploadUrlSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  contentType: z.string().min(1, 'Content type is required'),
  category: z.enum(LandMediaCategory).default(LandMediaCategory.MEDIA),
});

export class GetUploadUrlDto extends createZodDto(getUploadUrlSchema) {}
