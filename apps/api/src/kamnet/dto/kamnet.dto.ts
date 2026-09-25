import {
  PHONE_ERROR,
  PHONE_REGEX,
  KamnetAgentTier,
  KamnetApplicationStatus,
  KamnetCommissionStatus,
  KamnetLeadSource,
  KamnetLeadStatus,
  SUPPORTED_LANGUAGES,
} from '@kambriq/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ----- Agent Profile ----- //

export const updateAgentProfileDto = z.object({
  bio: z.string().max(2000).optional(),

  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z
    .string()
    .optional()
    .refine((v) => !v || PHONE_REGEX.test(v), PHONE_ERROR),
  language: z.enum(SUPPORTED_LANGUAGES).optional(),

  avatarUrl: z.url('Must be a valid URL').optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

export class UpdateAgentProfileDto extends createZodDto(updateAgentProfileDto) {}

/**
 * P11 - the agent's decision to appear in the public directory, or to stop.
 *
 * Its own schema rather than a field on `updateAgentProfileDto`: that one is a
 * bag of optional presentational fields, and a permission to publish somebody's
 * name, face and city does not belong somewhere it can be carried along by a
 * partial update nobody read closely.
 *
 * `listed` is REQUIRED and has no default. An absent field would have to mean
 * something, and both readings are wrong: "leave it alone" makes the route a
 * no-op that answers 200, and "false" withdraws consent because a key was
 * forgotten. One boolean, stated explicitly, in both directions.
 */
export const setPublicListingConsentSchema = z.object({
  listed: z.boolean(),
});

export class SetPublicListingConsentDto extends createZodDto(setPublicListingConsentSchema) {}

/** Admin: Update agent status */
export const updateAgentStatusSchema = z.object({
  tier: z.enum(KamnetAgentTier),
});

export class UpdateAgentStatusDto extends createZodDto(updateAgentStatusSchema) {}

export const agentFilterSchema = z.object({
  tier: z.enum(KamnetAgentTier).optional(),
  country: z.string().optional(),
  search: z.string().optional(), // search by code, name, or email
});

export class AgentFilterDto extends createZodDto(agentFilterSchema) {}

// ----- Applications ----- //

export const submitApplicationSchema = z.object({
  kcaNumber: z.string().min(1, 'KCA number is required'),
  sponsorCode: z.string().optional(),
  motivation: z.string().max(2000).optional(),
});

export class SubmitApplicationDto extends createZodDto(submitApplicationSchema) {}

export const reviewApplicationSchema = z.object({
  status: z.enum([KamnetApplicationStatus.APPROVED, KamnetApplicationStatus.REJECTED]),
  reviewNote: z.string().max(1000).optional(),
});

export class ReviewApplicationDto extends createZodDto(reviewApplicationSchema) {}

export const applicationFilterSchema = z.object({
  status: z.enum(KamnetApplicationStatus).optional(),
  search: z.string().optional(), // search by applicant name or email
});

export class ApplicationFilterDto extends createZodDto(applicationFilterSchema) {}

// ----- Commissions ----- //

export const createCommissionSchema = z.object({
  agentId: z.uuid(),
  landId: z.uuid(),
  // Required. References the source reservation.
  reservationId: z.uuid(),
  level: z.number().int().min(0).max(3).default(0),
  pv: z.number().min(0).max(2), // Point Valeur Coefficient
  tpc: z.number().min(0).max(1), //Commission rate (0.05 = 5%)
  amount: z.number().int().positive('Amount must be positive'),
});

export class CreateCommissionDto extends createZodDto(createCommissionSchema) {}

export const updateCommitionStatusSchema = z.object({
  status: z.enum(KamnetCommissionStatus),
});

export class UpdateCommissionStatusDto extends createZodDto(updateCommitionStatusSchema) {}

export const commissionFilterSchema = z.object({
  status: z.enum(KamnetCommissionStatus).optional(),
  agentId: z.uuid().optional(),
});

export class CommissionFilterDto extends createZodDto(commissionFilterSchema) {}

// ----- Leads ----- //

export const createLeadSchema = z.object({
  clientName: z.string().min(1, 'Client name is required').max(200),
  clientEmail: z.email(),
  clientPhone: z.string().max(20),
  source: z.enum(KamnetLeadSource),
  notes: z.string().max(2000),
});

export class CreateLeadDto extends createZodDto(createLeadSchema) {}

export const updateLeadSchema = z.object({
  clientName: z.string().min(1).max(200).optional(),
  clientEmail: z.email().optional(),
  clientPhone: z.string().max(20).optional(),
  source: z.enum(KamnetLeadSource).optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(KamnetLeadStatus).optional(),
});

export class UpdateLeadDto extends createZodDto(updateLeadSchema) {}

export const leadFilterSchema = z.object({
  status: z.enum(KamnetLeadStatus).optional(),
  search: z.string().optional(),
});

export class LeadFilterDto extends createZodDto(leadFilterSchema) {}

// ----- Network ----- //

// Agent view: depth only
export const networkTreeQuerySchema = z.object({
  depth: z.coerce.number().int().min(1).max(3).default(1),
});

export class NetworkTreeQueryDto extends createZodDto(networkTreeQuerySchema) {}

// Admin view: optional root agent scope + depth
export const adminNetworkTreeQuerySchema = z.object({
  rootAgentId: z.uuid().optional(),
  depth: z.coerce.number().int().min(1).max(3).default(1),
});

export class AdminNetworkTreeQueryDto extends createZodDto(adminNetworkTreeQuerySchema) {}
