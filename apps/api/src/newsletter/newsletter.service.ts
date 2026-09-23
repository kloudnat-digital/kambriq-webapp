import { maskEmail } from '@kambriq/common';
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, CreateContactCommand } from '@aws-sdk/client-sesv2';

/** What the controller hands over: the DTO, plus the policy the consent pointed at. */
export type SubscribeNewsletterInput = {
  email: string;
  locale: 'fr' | 'en';
  consent: boolean;
  /** The privacy policy the consent text pointed at, as the page rendered it. */
  consentPolicyPath: string;
};

/** Thrown when a subscription arrives without consent. Never a silent drop. */
export class NewsletterConsentRequiredError extends Error {
  constructor() {
    super(
      'Refusing to subscribe an address without consent. The checkbox and the DTO each ' +
        'refuse it; this is the layer that refuses a caller who went round the DTO.',
    );
    this.name = 'NewsletterConsentRequiredError';
  }
}

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

  /**
   * P2 - the consent is stored on the SES contact itself, as its attributes,
   * because the contact list is where the subscription lives: a record of the
   * agreement that sits anywhere else can be separated from the address it is
   * about. Same three facts the contact form stores on its row.
   */
  async subscribe(input: SubscribeNewsletterInput): Promise<void> {
    if (input.consent !== true) throw new NewsletterConsentRequiredError();

    /**
     * The server's clock, never the browser's. A consent timestamp supplied by
     * a caller is a claim about the past; this is a record of an event.
     */
    const consentGivenAt = new Date();

    try {
      await this.sesClient.send(
        new CreateContactCommand({
          ContactListName: this.contactListName,
          EmailAddress: input.email,
          AttributesData: JSON.stringify({
            consentGivenAt: consentGivenAt.toISOString(),
            consentPolicyPath: input.consentPolicyPath,
            locale: input.locale,
          }),
        }),
      );
      this.logger.log('Newsletter subscription registered %o', { email: maskEmail(input.email) });
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
