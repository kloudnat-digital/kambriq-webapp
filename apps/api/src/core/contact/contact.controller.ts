import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@kambriq/common';
import { ContactService } from './contact.service';
import { SubmitContactRequestDto } from './contact.dto';

/**
 * L1 - the public contact form's one route.
 *
 * `@Public()` because a prospect has no account: that is the whole point of the
 * form. `route-guards.spec.ts` pins the public surface as a count per file, so
 * a second public route added here fails until somebody says it is deliberate.
 *
 * Throttled like the newsletter, and for the same reason: an unauthenticated
 * write endpoint is a mailbox anybody can address. Three a minute is generous
 * for a person and useless for a script.
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
      // The policy the consent text pointed at. Fixed here rather than accepted
      // from the caller: what somebody agreed to is a fact about our page, not
      // a value the page gets to assert about itself.
      consentPolicyPath: '/legal/privacy',
    });
  }
}
