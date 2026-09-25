import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@kambriq/common';
import { ContactService } from './contact.service';
import { SubmitContactRequestDto } from './contact.dto';

/**
 * Handles submissions from the public contact form.
 *
 * Marked `@Public()` to allow unauthenticated prospects.
 * Throttled to 3 requests per minute to mitigate abuse of the unauthenticated write endpoint.
 */
@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit a contact request from the public site',
    description:
      'Stores the request, then announces it: one notification to the back office and one ' +
      "acknowledgement to the prospect, in the page's language. **The write is what decides " +
      'success** - a 201 means the row exists. An email that cannot be queued is logged at ' +
      'error and does not fail the request, because the lead is already safe and the daily ' +
      'digest counts rows rather than messages. Consent is required and its timestamp is the ' +
      "server's, never the caller's.",
  })
  @ApiResponse({ status: 201, description: 'Request stored. The reference identifies it.' })
  @ApiResponse({ status: 400, description: 'Validation failed, or consent was not given.' })
  async submit(@Body() dto: SubmitContactRequestDto): Promise<{ id: string; reference: string }> {
    return this.contact.submit({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      subject: dto.subject,
      message: dto.message,
      locale: dto.locale,
      consent: dto.consent,
      // Consent policy path is fixed server-side to ensure accuracy of the agreement context.
      consentPolicyPath: '/legal/privacy',
    });
  }
}
