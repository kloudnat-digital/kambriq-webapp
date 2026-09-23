import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@kambriq/common';
import { KbsCertificatesService } from '../certificates/certificates.service';

@ApiTags('KBS - Public')
@Controller('kbs/public')
export class KbsPublicController {
  constructor(private readonly certificatesService: KbsCertificatesService) {}

  /**
   * Throttled because the numbers are guessable and the answer is about a
   * person's qualification.
   *
   * A KCA number is `KCA-YYYYMMDD-XXXX` - a date and four hex characters - and
   * `verifyCertificate`'s own docstring says so: "KCA numbers are a date and
   * four hex characters, so they can be enumerated". Unthrottled, that makes
   * this route a way to walk the register: 65,536 requests per issue date
   * separates the numbers KAMBRIQ has issued from the ones it has not, and a
   * VALID verdict says somebody holds a current certificate. The endpoint
   * deliberately returns no name, which is what keeps the harvest thin - but
   * "thin" is not a rate limit.
   *
   * 30 a minute, the same shape as `kamnet-public.controller.ts`: a read a
   * visitor may legitimately reload, not a write that sends mail (contact and
   * newsletter use 3). The global `ThrottlerBehindProxyGuard` keys on the
   * forwarded address, so the ALB does not collapse every visitor into one
   * caller.
   *
   * The decorators below stay contiguous - no blank line, no comment between
   * them - because `contract-guard-parity.spec.ts` (A20) reads a route's stack
   * by walking UP from `@Get` and stopping at the first blank line.
   * `public-routes-are-throttled.spec.ts` is what keeps the `@Throttle` here.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('verify/:kcaNumber')
  @ApiOperation({
    summary: 'Verify a KCA certificate by number',
    description:
      'Public endpoint to verify the authenticity and validity of a KCA certificate. `status` is the verdict: VALID, EXPIRED, REVOKED, or UNKNOWN for a number the register does not hold. No authentication required.',
  })
  @ApiParam({
    name: 'kcaNumber',
    description: 'KCA certificate number (format: KCA-YYYYMMDD-XXXX)',
    example: 'KCA-20240115-0042',
  })
  // One response, deliberately. An unknown number is an answer, not an error:
  // it returns 200 with status UNKNOWN. This used to declare a 404 the service
  // has never sent.
  @ApiResponse({
    status: 200,
    description:
      'The verdict: status VALID, EXPIRED or REVOKED with the certificate dates, or UNKNOWN with valid=false.',
  })
  async verifyCertificate(@Param('kcaNumber') kcaNumber: string) {
    return this.certificatesService.verifyCertificate(kcaNumber);
  }
}
