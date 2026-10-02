// ----- Types -----
export { RoleCode } from './types/roles.enum';
export { ROLE_HIERARCHY, SUPER_ADMIN_ROLE, effectiveRoles } from './types/role-hierarchy';

// ----- Payments (G1) -----
export {
  PaymentChannel,
  PAYMENT_CHANNELS,
  SELECTABLE_CHANNELS,
  RECORDABLE_CHANNELS,
  PAYER_MAY_DIFFER_CHANNELS,
  REFERENCE_CHANNEL_SEPARATOR,
  requiresPaidBy,
  channelLabel,
  formatReferenceWithChannel,
} from './payments/payment-channels';
export type { ChannelDefinition } from './payments/payment-channels';
export { PaymentPurpose } from './payments/payment-purpose';
export {
  PaymentState,
  PAYMENT_TRANSITIONS,
  TERMINAL_STATES,
  COMMITTING_STATES,
  IllegalPaymentTransitionError,
  AutomaticTransitionForbiddenError,
  UnnamedActorError,
  assertActorIsNamed,
  assertTransitionAllowed,
  assertTransitionIsDeliberate,
  EVIDENCED_STATES,
  EvidenceRequiredError,
  assertTransitionIsEvidenced,
  sumReceipts,
  outstandingOf,
} from './payments/payment-state';

export {
  REFERENCE_ALPHABET,
  REFERENCE_BODY_LENGTH,
  REFERENCE_BODY_SPACE,
  REFERENCE_PREFIX,
  buildReference,
  checkCharacter,
  encodeBody,
  formatReference,
  normalizeReference,
  referencePeriod,
  validateReference,
  type ReferenceRejection,
  type ReferenceValidation,
} from './payments/payment-reference';

export {
  ISO_DATE_PATTERN,
  formatHumanDate,
  formatHumanDateTime,
  formatMoney,
} from './payments/payment-format';
export {
  issueVerificationToken,
  hashToken,
  verificationTokenExpiryHours,
  type VerificationTokenStore,
} from './auth/verification-token';
export {
  planBootstrap,
  type BootstrapIdentity,
  type BootstrapPlan,
  type ExistingAccount,
} from './bootstrap/bootstrap-plan';
export type { JwtPayload, RequestUser } from './types/user-payload.type';

// ----- Exceptions -----
export * from './exceptions';

// ----- Config -----
export { validateEnv, envSchema, type EnvConfig } from './config/env.validation';

// ----- Utils -----
export { hashPassword, comparePassword } from './utils/hash.util';
export { applyCoefficient, formatXAF, formatXAFCompact } from './utils/money.util';
export { maskEmail, redactEmails, changedKeys } from './utils/log-redact';

// ----- DTOs -----
export {
  PaginationQueryDto,
  paginationQuerySchema,
  buildPaginationMeta,
  buildPaginatedResponse,
  type PaginationMeta,
  type PaginationQuery,
} from './dto/pagination.dto';
export { ageInDays, withOldestWaiting, ONE_DAY_MS } from './dto/queue-aging';
export { sortField, TIMESTAMP_SORTS } from './dto/sort-field';

// ----- Decorators -----
export { CurrentUser, Roles, ROLES_KEY, Public, IS_PUBLIC_KEY } from './decorators';

// ----- Constants -----
export * from './constants/core';
export * from './constants/kbs';
export * from './constants/queue';
export * from './constants/email';
export * from './constants/i18n';
export * from './constants/kamnet';
export * from './constants/lands';
export * from './constants/phone';

// ----- Services -----
export { StorageService } from './services/storage.service';

// ----- Queue -----
export { QueueModule } from './queue/queue.module';

// ----- Redis -----
export { RedisModule } from './redis/redis.module';
export { RedisService } from './redis/redis.service';
// D20 - one decision about TLS and the AUTH token, shared by every client:
// RedisService, the BullMQ root connection, and prisma/bootstrap-admins.ts.
export {
  redisConnectionOptions,
  type RedisConnectionOptions,
  type RedisEnvLookup,
} from './redis/redis-connection';

// ----- Email -----
export { EmailModule } from './email/email.module';
export { LoudWorkerHost } from './queue/loud-worker-host';
export { EmailService } from './email/email.service';
export * from './email/templates';

// ----- I18n -----
export { UserLanguageResolver, getI18nPath } from './i18n/i18n.config';

// ----- Guards -----
export { JwtAuthGuard } from './guards/jwt-auth.guard';
export { RolesGuard } from './guards/roles.guard';

// ----- Middleware -----
export {
  CorrelationIdMiddleware,
  CORRELATION_ID_HEADER,
} from './middleware/correlation-id.middleware';
export {
  isIndexableEnvironment,
  NOINDEX_HEADER,
  PRODUCTION_APP_ENV,
  robotsHeaderMiddleware,
} from './middleware/robots-header.middleware';

// ----- Interceptors -----
export { TransformResponseInterceptor } from './interceptors/transform-response.interceptor';

// ----- Filters -----
export { GlobalExceptionFilter } from './filters/global-exception.filter';
export { PrismaExceptionFilter } from './filters/prisma-exception.filter';
export { ZodExceptionFilter } from './filters/zod-exception.filter';

// ----- CMS (wave 7) -----
export {
  LEGAL_POLICY_TYPE,
  POLICY_LANGUAGES,
  POLICY_SLUGS,
  POLICY_SLUG_PATTERN,
  POLICY_PUBLISH_FILTER,
  POLICY_PUBLISH_PROJECTION,
  POLICY_WEBHOOK_API_VERSION,
  POLICY_WEBHOOK_NAME,
  POLICY_WEBHOOK_PATH,
  CONSENT_POLICY_SLUG,
  policyDocumentId,
  policyInForceWhere,
} from './cms/legal-policy';
export type { PolicyLanguage, PolicySlug } from './cms/legal-policy';
export {
  CONTENT_BLOCK_DECORATORS,
  CONTENT_BLOCK_LISTS,
  CONTENT_BLOCK_STYLES,
  CONTENT_BLOCK_TYPES,
  CONTENT_PAGE_LANGUAGES,
  CONTENT_PAGE_ROUTES,
  CONTENT_PAGE_SLUGS,
  CONTENT_PAGE_TYPE,
  contentPageDocumentId,
} from './cms/content-page';
export type { ContentBlockType, ContentPageSlug } from './cms/content-page';
export {
  CMS_API_VERSION,
  CMS_REVALIDATE_SECONDS,
  DELIVERY_PROJECTION,
  DOCUMENT_BY_ID_QUERY,
  cmsCacheTag,
} from './cms/delivery';

// ----- KBS label definitions (wave 7) -----
export {
  KBS_LABELS,
  KBS_LABEL_DEFINITIONS,
  kbsLabelDefinition,
  kbsLabelDescriptionText,
} from './kbs/label-definitions';
export type {
  KbsLabelCode,
  KbsLabelDefinition,
  KbsLabelLanguage,
  KbsLabelRun,
} from './kbs/label-definitions';
// ----- Lands (P24) -----
export {
  TITLE_NUMBER_EXAMPLE,
  KNOWN_DEPARTMENT_CODES,
  parseTitleNumber,
  isUnlistedDepartment,
} from './lands/title-number';
export type { TitleNumber } from './lands/title-number';
export { REAL_TITLES, REAL_TITLES_FILE, isListedTitle } from './lands/real-titles';
export type { RealTitle } from './lands/real-titles';

// ----- API documentation (A43) -----
export { LOCAL_APP_ENV, servesApiDocs } from './config/api-docs';

// ----- Environment (A48) -----
export {
  appEnvironment,
  apiLogLevel,
  isLocalEnvironment,
  prettyLogs,
  prismaLogLevels,
} from './config/app-env';
