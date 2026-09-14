import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

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
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const xff = req['headers'] as Record<string, string | string[]> | undefined;
    const forwarded = xff?.['x-forwarded-for'];
    const chain = Array.isArray(forwarded) ? forwarded.join(',') : forwarded;
    if (typeof chain === 'string' && chain.trim().length > 0) {
      const parts = chain
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length > 0) return parts[parts.length - 1];
    }
    return (req['ip'] as string) ?? 'unknown';
  }
}
