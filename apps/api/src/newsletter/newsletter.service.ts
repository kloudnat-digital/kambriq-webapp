import { maskEmail } from '@kambriq/common';
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, CreateContactCommand } from '@aws-sdk/client-sesv2';

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);
  private readonly sesClient: SESv2Client;
  private readonly contactListName: string;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>('AWS_REGION', 'eu-central-1');
    this.contactListName = this.config.get<string>(
      'AWS_SES_CONTACT_LIST_NAME',
      'kambriq-newsletter',
    );

    // No explicit credentials: the default provider chain resolves the ECS task
    // role on Fargate and the developer profile locally. The previous static-key
    // gate meant the client was never built in any deployed environment, so
    // subscribe() resolved successfully while storing nothing.
    this.sesClient = new SESv2Client({ region });
  }

  async subscribe(email: string): Promise<void> {
    try {
      await this.sesClient.send(
        new CreateContactCommand({
          ContactListName: this.contactListName,
          EmailAddress: email,
        }),
      );
      this.logger.log('Newsletter subscription registered %o', { email: maskEmail(email) });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AlreadyExistsException') {
        throw new ConflictException('This email is already subscribed.');
      }
      // Anything else propagates. There is deliberately no degraded path: a
      // subscription that cannot be stored must not look like one that was.
      throw error;
    }
  }
}
