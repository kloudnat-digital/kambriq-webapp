// ----- Types -----
export { RoleCode } from './types/roles.enum';
export { ROLE_HIERARCHY, SUPER_ADMIN_ROLE, effectiveRoles } from './types/role-hierarchy';
export type { JwtPayload, RequestUser } from './types/user-payload.type';

// ----- Exceptions -----
export * from './exceptions';

// ----- Config -----
export { validateEnv, envSchema, type EnvConfig } from './config/env.validation';

// ----- Utils -----
export { hashPassword, comparePassword } from './utils/hash.util';
export { applyCoefficient, formatXAF, formatXAFCompact } from './utils/money.util';
export { maskEmail, changedKeys } from './utils/log-redact';

// ----- DTOs -----
export {
  PaginationQueryDto,
  paginationQuerySchema,
  buildPaginationMeta,
  buildPaginatedResponse,
  type PaginationMeta,
  type PaginationQuery,
} from './dto/pagination.dto';

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

// ----- Email -----
export { EmailModule } from './email/email.module';
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

// ----- Interceptors -----
export { TransformResponseInterceptor } from './interceptors/transform-response.interceptor';

// ----- Filters -----
export { GlobalExceptionFilter } from './filters/global-exception.filter';
export { PrismaExceptionFilter } from './filters/prisma-exception.filter';
export { ZodExceptionFilter } from './filters/zod-exception.filter';
