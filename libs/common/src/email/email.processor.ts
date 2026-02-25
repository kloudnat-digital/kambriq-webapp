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

  constructor(
    private readonly config: ConfigService,
    private readonly i18n: I18nService,
  ) {
    super();

    this.fromAddress = this.config.get<string>(
      'EMAIL_FROM',
      'noreply@kambriq.com',
    );
    this.fromName = this.config.get<string>('EMAIL_FROM_NAME', 'KAMBRIQ Team');

    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    const region = this.config.get<string>('AWS_REGION', 'eu-west-3');

    if (accessKeyId && secretAccessKey) {
      this.sesClient = new SESv2Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log('SES Configured successfully', {
        region,
        fromAddress: this.fromAddress,
        fromName: this.fromName,
      });
    } else {
      this.sesClient = null;
      this.logger.warn(
        'SES not configured - Emails will be logged to console.',
      );
    }
  }

  async process(job: Job<EmailJobPayload>): Promise<unknown> {
    if (job.name !== NOTIFICATIONS_JOBS.SEND_EMAIL) {
      this.logger.warn(`Unknown EMAIL job: ${job.name}`);
      return null;
    }

    const { to, lang, template, args } = job.data;

    const { subject, html } = buildEmail(
      template,
      lang as SupportedLanguage,
      args,
      this.i18n,
    );

    if (!this.sesClient) {
      this.logger.log(
        `@[dev-email]\n` +
          `To:        ${to}\n` +
          `Subject:   ${subject}\n` +
          `Template:  ${template} (${lang})\n` +
          `Preview:   ${this.stripHtml(html).substring(0, 200)}...`,
      );

      return { delivered: false, reason: 'dev-mode', to, subject };
    }

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

      this.logger.log('Email sent', {
        to,
        subject,
        messageId: result.MessageId,
      });
      return { delivered: true, messageId: result.MessageId, to, subject };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to send email', {
        to,
        subject,
        error: message,
      });
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
