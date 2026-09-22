import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@kambriq/common';
import { KamnetAgentsService } from '../agents/agents.service';

/**
 * P11 - the one KAMNET surface a visitor with no account may read.
 *
 * Separate from `KamnetAgentController` rather than a `@Public()` route added
 * to it: that controller carries `@ApiBearerAuth()` at the class level and
 * every one of its routes is `@Roles(...)`. A single unauthenticated route
 * among them would be one decorator away from being gated, and one missing
 * decorator away from publishing an agent's leads.
 *
 * After the P9 arbitrage this directory is also the ONLY public presence KAMNET
 * keeps. It is proof, not recruitment: nothing here describes what an agent
 * earns, and `toPublicDirectoryEntry` is what makes that structural rather than
 * a matter of remembering.
 */
@ApiTags('KAMNET - Public')
@Controller('kamnet/public')
export class KamnetPublicController {
  constructor(private readonly agentsService: KamnetAgentsService) {}

  /**
   * Throttled explicitly. `kbs-public.controller.ts` - the other anonymous
   * route in this API - carries no throttle at all, and that is the gap this
   * one does not repeat.
   *
   * 30 a minute, not the 3 that `contact` and `newsletter` use: those are
   * writes that send mail, and this is a read of a page a visitor may
   * legitimately reload. The global `ThrottlerBehindProxyGuard` keys on the
   * forwarded address, so the ALB does not make every visitor one caller.
   *
   * ---------------------------------------------------------------------------
   * The decorators below must stay contiguous
   * ---------------------------------------------------------------------------
   * `contract-guard-parity.spec.ts` (A20) reads a route's decorator stack by
   * walking UP from `@Get` and stopping at the first blank line. This comment
   * sat between `@Public()` and `@Get` in the first version, and although
   * comments are stripped the blank lines around it were not: the scan stopped
   * short, decided the route was guarded, and demanded `@ApiBearerAuth` on an
   * anonymous endpoint. Adding it would have documented a token this route
   * never requires, which is the exact inversion that spec exists to catch.
   * `route-guards.spec.ts` counted the same `@Public()` quite happily, so one
   * parser was satisfied and the other was not.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('agents')
  @ApiOperation({
    summary: 'The public directory of certified agents',
    description:
      'Agents who have consented to be listed, are not suspended, and hold a certificate that ' +
      'stands. Each entry carries a first name, last name, city, country, avatar when set, the ' +
      'KCA number and the date it was issued - and nothing else. No sales, no referrals, no ' +
      'sponsor, no tier, no contact details. The KCA number is what a reader checks against ' +
      '/kbs/public/verify/:kcaNumber. No authentication required.',
  })
  @ApiResponse({
    status: 200,
    description: 'The listed agents. An empty array when nobody has consented.',
  })
  async listCertifiedAgents() {
    return this.agentsService.listPublicDirectory();
  }
}
