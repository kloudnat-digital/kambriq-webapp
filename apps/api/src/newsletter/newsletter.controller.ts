import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@kambriq/common';
import { NewsletterService } from './newsletter.service';
import { SubscribeNewsletterDto } from './newsletter.dto';

@ApiTags('Newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('subscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Subscribe an email address to the newsletter' })
  @ApiResponse({ status: 204, description: 'Subscribed successfully.' })
  async subscribe(@Body() dto: SubscribeNewsletterDto): Promise<void> {
    await this.newsletterService.subscribe({
      email: dto.email,
      locale: dto.locale,
      consent: dto.consent,
      // The page the consent text links to. Recorded with the consent, because
      // consent is to a document and documents change.
      consentPolicyPath: '/legal/privacy',
    });
  }
}
