import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, CreateContactCommand, CreateContactListCommand } from '@aws-sdk/client-sesv2';

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);
  private readonly sesClient: SESv2Client | null;
  private readonly contactListName: string;

  constructor(private readonly config: ConfigService) {
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    const region = this.config.get<string>('AWS_REGION', 'eu-west-3');
    this.contactListName = this.config.get<string>(
      'AWS_SES_CONTACT_LIST_NAME',
      'kambriq-newsletter',
    );

    if (accessKeyId && secretAccessKey) {
      this.sesClient = new SESv2Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log('SES contact list configured successfully');
    } else {
      this.sesClient = null;
      this.logger.warn('SES not configured — subscriptions will be logged to console.');
    }
  }

  async subscribe(email: string): Promise<void> {
    if (!this.sesClient) {
      this.logger.log(`[dev-newsletter] Subscribe: ${email}`);
      return;
    }

    try {
      await this.sesClient.send(
        new CreateContactCommand({
          ContactListName: this.contactListName,
          EmailAddress: email,
        }),
      );
      this.logger.log('Newsletter subscription registered', { email });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AlreadyExistsException') {
        throw new ConflictException('This email is already subscribed.');
      }
      throw error;
    }
  }

  // Called once on app startup to ensure the contact list exists.
  async ensureContactList(): Promise<void> {
    if (!this.sesClient) return;

    try {
      await this.sesClient.send(
        new CreateContactListCommand({ ContactListName: this.contactListName }),
      );
      this.logger.log(`Contact list '${this.contactListName}' created`);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AlreadyExistsException') {
        return; // Already exists — nothing to do
      }
      throw error;
    }
  }
}
