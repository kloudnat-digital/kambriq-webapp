import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@kambriq/common';
import { EmailEventsService, type EmailEventsOutcome } from './email-events.service';

/**
 * Receives SES bounce and complaint events from Amazon SNS (C24).
 *
 * `@Public()` removes the JWT requirement only: `EmailEventsService` believes a
 * delivery when its SNS signature verifies and it comes from the configured
 * topic. SNS posts `text/plain`, parsed to a string in `main.ts`.
 *
 * Throttled at 60 per minute. Every delivery arrives from SNS, so they share
 * one caller; SNS retries a refused delivery rather than losing it.
 */
@ApiTags('Email')
@Controller('email')
export class EmailEventsController {
  constructor(private readonly events: EmailEventsService) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('ses-events')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record an SES bounce or complaint delivered by SNS' })
  @ApiResponse({ status: 200, description: 'Recorded, or the subscription confirmed.' })
  @ApiResponse({ status: 401, description: 'The SNS signature does not verify.' })
  @ApiResponse({ status: 403, description: 'Not from the SES events topic.' })
  @ApiResponse({ status: 503, description: 'SES_EVENTS_TOPIC_ARN is not set.' })
  async receive(@Body() body: unknown): Promise<EmailEventsOutcome> {
    return this.events.receive(body);
  }
}
