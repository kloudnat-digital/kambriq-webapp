import { Module, OnModuleInit } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { NewsletterController } from './newsletter.controller';

@Module({
  controllers: [NewsletterController],
  providers: [NewsletterService],
})
export class NewsletterModule implements OnModuleInit {
  constructor(private readonly newsletterService: NewsletterService) {}

  async onModuleInit(): Promise<void> {
    await this.newsletterService.ensureContactList();
  }
}
