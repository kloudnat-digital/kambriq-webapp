import { Injectable, Logger } from '@nestjs/common';
import { TemplateKey } from './templates';
import { InjectQueue } from '@nestjs/bullmq';
import { NOTIFICATIONS_JOBS, QUEUES } from '../constants/queue';
import { Queue } from 'bullmq';

export interface EmailJobPayload {
  to: string;
  template: TemplateKey; // e.g. 'verification', 'examPassed', etc.
  lang: string; // 'en' | 'fr'
  args: Record<string, string | number>; // interpolation args
}

/**
 * EmailService - Enqueues emails as BullMQ jobs for async delivery
 *
 * Usage:
 *  await this.emailService.send({
 *    to: 'user@example.com',
 *    template: 'verification',
 *    lang: 'en',
 *    args: {
 *      name: 'John Doe',
 *      code: '123456'
 *    }
 *  })
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectQueue(QUEUES.NOTIFICATIONS) private readonly notifQueue: Queue,
  ) {}

  async send(payload: EmailJobPayload): Promise<void> {
    await this.notifQueue.add(NOTIFICATIONS_JOBS.SEND_EMAIL, payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 50,
      removeOnFail: 100,
    });

    this.logger.debug('Email queued', {
      to: payload.to,
      template: payload.template,
      lang: payload.lang,
    });
  }

  async sendBatch(payloads: EmailJobPayload[]): Promise<void> {
    const jobs = payloads.map((payload) => ({
      name: NOTIFICATIONS_JOBS.SEND_EMAIL,
      data: payload,
      opts: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    }));
    await this.notifQueue.addBulk(jobs);
    this.logger.debug(`${payloads.length} emails queued`);
  }
}
