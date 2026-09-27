import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@kambriq/common';
import { PolicyArchiveService, type PolicyArchiveOutcome } from './policy-archive.service';
import { PolicyPublishDto } from './policy-publish.dto';
import { SanityWebhookGuard } from './sanity-webhook.guard';

/**
 * Receives GROQ-powered webhook deliveries from Sanity.
 *
 * `@Public()` removes the JWT requirement; `SanityWebhookGuard` is what
 * authenticates the caller, by the HMAC signature over the raw body.
 *
 * Throttled at 30 per minute. Publishing every legal policy in both languages is
 * eight deliveries, and Sanity retries twice per delivery, so the limit leaves
 * room for a bulk publish while still bounding an anonymous endpoint.
 */
@ApiTags('CMS')
@Controller('cms/webhooks')
export class CmsWebhooksController {
  constructor(private readonly policies: PolicyArchiveService) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(SanityWebhookGuard)
  @Post('sanity')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Archive the rendered text of a published legal policy',
    description:
      'Verifies the Sanity signature over the raw request body, renders the Portable Text and ' +
      'stores it. The response says which of the three things happened - archived, ' +
      'already-archived, or ignored - so a delivery that did nothing is not indistinguishable ' +
      'from one that archived. A repeated delivery of the same revision is a no-op and answers ' +
      '200, because the unique index on document and revision refuses the duplicate.',
  })
  @ApiResponse({
    status: 200,
    description: 'The delivery was accepted. The body says what it did.',
  })
  @ApiResponse({ status: 400, description: 'The projection did not match the expected payload.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid signature.' })
  @ApiResponse({ status: 503, description: 'SANITY_WEBHOOK_SECRET is not configured.' })
  async sanity(@Body() dto: PolicyPublishDto): Promise<PolicyArchiveOutcome> {
    return this.policies.archive(dto);
  }
}
