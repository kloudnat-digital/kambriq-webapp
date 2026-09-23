import { Module } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { NewsletterController } from './newsletter.controller';

// Note: The SES contact list is managed via Terraform.
// The API is granted ses:CreateContact to add contacts, but not ses:CreateContactList.
@Module({
  controllers: [NewsletterController],
  providers: [NewsletterService],
})
export class NewsletterModule {}
