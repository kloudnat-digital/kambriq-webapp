import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CALLER_SECRET_ENV,
  callerSecretMismatch,
  readCallerSecret,
  resolveTracker,
} from './caller-identity';

/**
 * A2 - throttle by the real client, not by the load balancer.
 *
 * The tasks receive every request from the ALB, so Express's `req.ip` is the
 * ALB's address for all of them. The default ThrottlerGuard keys on `req.ip`,
 * which meant one throttle bucket for the ENTIRE deployment: the auth limit of
 * 10/60s was 10 across every client at once, not 10 per client. In production
 * that is a shared quota one user can exhaust for everyone; in CI it is the 429
 * collision, where the delivery-journey and e2e jobs run against dev at the same
 * time and trip the shared bucket.
 *
 * The ALB appends the connecting client's address to X-Forwarded-For, so the
 * LAST entry is the client IP the ALB actually saw - not the leftmost, which a
 * client can send and therefore spoof to change its own bucket. With one proxy
 * (dev is ALB-only, no CDN) the last entry is the client. If a CDN is ever put
 * in front, this offset has to move one to the left; until then, last is right.
 *
 * A45 - one exception, and only one. A call the web server makes for a visitor
 * arrives with the WEB TASK's address last, so every visitor it served shared
 * one bucket. The web now vouches for the visitor with a secret only it and the
 * API hold, and that vouched address is used instead. The rule, and what was
 * measured to reach it, is in `caller-identity.ts`.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  /** Read once: a secret does not change while the process runs. */
  private readonly callerSecret = ThrottlerBehindProxyGuard.loadCallerSecret();

  private static loadCallerSecret(): string | null {
    const secret = readCallerSecret(process.env);
    if (!secret) {
      // Not an error: without it the guard keeps its old rule. But it is the
      // setting that makes limits count per visitor, so its absence is said.
      new Logger(ThrottlerBehindProxyGuard.name).warn(
        `${CALLER_SECRET_ENV} is not set: calls the web makes for its visitors all count ` +
          "against the web task's own address.",
      );
    }
    return secret;
  }

  /**
   * Said once per process, not once per request.
   *
   * A wrong secret is wrong on every call, so logging each one would bury the
   * line it matters in. Once is enough to tell somebody reading the logs that
   * the two sides disagree.
   */
  private mismatchReported = false;

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    if (
      !this.mismatchReported &&
      callerSecretMismatch(req['headers'] as never, this.callerSecret)
    ) {
      this.mismatchReported = true;
      new Logger(ThrottlerBehindProxyGuard.name).warn(
        `A caller sent ${CALLER_SECRET_ENV} and it does not match: the address it vouched for ` +
          'is ignored and its visitors share one bucket. Check the secret on both sides.',
      );
    }
    return resolveTracker(req, this.callerSecret);
  }
}
