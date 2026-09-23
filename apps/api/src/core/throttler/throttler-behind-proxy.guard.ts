import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Custom ThrottlerGuard to correctly identify the client IP behind a load balancer.
 * Extracts the client IP from the last entry in the X-Forwarded-For header to ensure
 * rate limiting is applied per client rather than globally for the entire deployment.
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
