import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  RawBodyRequest,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isValidSignature, SIGNATURE_HEADER_NAME } from '@sanity/webhook';
import type { Request } from 'express';

export const SANITY_WEBHOOK_SECRET_VAR = 'SANITY_WEBHOOK_SECRET';

/**
 * Authenticates a Sanity webhook delivery by its HMAC-SHA256 signature.
 *
 * The route is `@Public()` because it carries no session; this guard is what
 * authenticates it. It runs after the global guards, so a flood is throttled
 * before any signature is computed.
 *
 * Verification uses the raw request bytes, never a re-encoded body: the hash is
 * over the input, and `JSON.parse` then `JSON.stringify` does not reproduce it.
 * `rawBody: true` at `NestFactory.create` is what makes those bytes available.
 *
 * An absent secret refuses every delivery, with a 503 rather than a 401 because
 * the signature was not the problem. It is not a permissive mode.
 *
 * Two bounds of `@sanity/webhook` 4.0.4, read from its source:
 *
 * - nothing checks the signature timestamp's age, so a captured delivery can be
 *   replayed. The unique index on `PolicySnapshot(documentId, revision)` is what
 *   makes a replay a no-op, so replay protection here is structural;
 * - the final comparison is a plain string comparison, not constant-time.
 */
@Injectable()
export class SanityWebhookGuard implements CanActivate {
  private readonly logger = new Logger(SanityWebhookGuard.name);

  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RawBodyRequest<Request>>();

    const secret = this.config.get<string>(SANITY_WEBHOOK_SECRET_VAR)?.trim();
    if (!secret) {
      this.logger.error(
        `${SANITY_WEBHOOK_SECRET_VAR} is not set. Refusing every CMS webhook delivery.`,
      );
      throw new ServiceUnavailableException('The CMS webhook is not configured.');
    }

    const signature = request.headers[SIGNATURE_HEADER_NAME];
    if (typeof signature !== 'string' || signature.length === 0) {
      throw new UnauthorizedException('Missing webhook signature.');
    }

    if (!request.rawBody) {
      // Reachable only if `rawBody: true` is dropped from bootstrap, which
      // `api-captures-raw-body.spec.ts` pins. Refuse rather than fall back to
      // the parsed body, which would verify a different byte sequence.
      this.logger.error('No raw body on the request. `rawBody: true` is missing from bootstrap.');
      throw new UnauthorizedException('Missing webhook signature.');
    }

    const valid = await isValidSignature(request.rawBody.toString('utf8'), signature, secret);
    if (!valid) throw new UnauthorizedException('Invalid webhook signature.');

    return true;
  }
}
