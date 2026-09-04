import { Module } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { NewsletterController } from './newsletter.controller';

// The SES contact list is a Terraform resource (kambriq-infra,
// envs/dev/ses-newsletter.tf). The API is granted ses:CreateContact and
// deliberately not ses:CreateContactList, so it adds contacts and never
// provisions infrastructure. The former onModuleInit hook that called
// ensureContactList() has been removed with it.
@Module({
  controllers: [NewsletterController],
  providers: [NewsletterService],
})
export class NewsletterModule {}
