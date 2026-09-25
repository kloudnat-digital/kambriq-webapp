import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { Logger } from '@nestjs/common';
import { NOTIFICATIONS_JOBS, QUEUES } from '../constants/queue';
import { Job } from 'bullmq';
import { EmailJobPayload } from './email.service';
import { buildEmail } from './templates';
import { SupportedLanguage } from '../constants/i18n';

@Processor(QUEUES.NOTIFICATIONS)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly sesClient: SESv2Client | null;
  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly transport: 'ses' | 'console';

  constructor(
    private readonly config: ConfigService,
    private readonly i18n: I18nService,
  ) {
    super();

    this.fromAddress = this.config.get<string>('EMAIL_FROM', 'noreply@kambriq.com');
    this.fromName = this.config.get<string>('EMAIL_FROM_NAME', 'KAMBRIQ Team');

    const region = this.config.get<string>('AWS_REGION', 'eu-central-1');
    this.transport =
      this.config.get<string>('EMAIL_TRANSPORT', 'ses') === 'console' ? 'console' : 'ses';

    if (this.transport === 'console') {
      this.sesClient = null;
      this.logger.warn('EMAIL_TRANSPORT=console - emails will be logged, not sent.');
      return;
    }

    // Default AWS credential provider chain (ECS task role or local profile).
    this.sesClient = new SESv2Client({ region });
    this.logger.log('SES transport active %o', {
      region,
      fromAddress: this.fromAddress,
      fromName: this.fromName,
    });
  }

  async process(job: Job<EmailJobPayload>): Promise<unknown> {
    if (job.name !== NOTIFICATIONS_JOBS.SEND_EMAIL) {
      throw new Error(`Unknown EMAIL job: ${job.name}`);
    }

    const { to, lang, template, args } = job.data;

    const { subject, html } = buildEmail(template, lang as SupportedLanguage, args, this.i18n);

    if (this.transport === 'console' || !this.sesClient) {
      this.logger.log(
        `@[console-email]\n` +
          `To:        ${to}\n` +
          `Subject:   ${subject}\n` +
          `Template:  ${template} (${lang})\n` +
          `Preview:   ${this.stripHtml(html).substring(0, 200)}...`,
      );

      return { delivered: false, transport: 'console', to, subject };
    }

    // Rethrow SES failures for BullMQ job retries.
    try {
      const result = await this.sesClient.send(
        new SendEmailCommand({
          FromEmailAddress: `${this.fromName} <${this.fromAddress}>`,
          Destination: { ToAddresses: [to] },
          Content: {
            Simple: {
              Subject: { Data: subject, Charset: 'UTF-8' },
              Body: { Html: { Data: html, Charset: 'UTF-8' } },
            },
          },
        }),
      );

      // Direct log interpolation prevents nestjs-pino context misinterpretation.
      this.logger.log(`Email sent to ${to} messageId=${result.MessageId} subject="${subject}"`);
      return { delivered: true, messageId: result.MessageId, to, subject };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Direct error log interpolation.
      this.logger.error(`Failed to send email to ${to} subject="${subject}" error=${message}`);
      throw error;
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
