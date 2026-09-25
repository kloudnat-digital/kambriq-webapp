import { Injectable, Logger } from '@nestjs/common';
import { isTransactional, TemplateKey } from './templates';
import { InjectQueue } from '@nestjs/bullmq';
import { NOTIFICATIONS_JOBS, QUEUES } from '../constants/queue';
import { Queue } from 'bullmq';

export interface EmailJobPayload {
  to: string;
  template: TemplateKey; // e.g. 'verification', 'examPassed', etc.
  lang: string; // 'en' | 'fr'
  args: Record<string, string | number>; // interpolation args
}

/** Enqueues emails as BullMQ jobs for asynchronous delivery. */
/** Outcome of an update email delivery attempt. */
export type EmailOutcome =
  | { status: 'queued' }
  | { status: 'suppressed'; reason: 'user-preference' };

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(@InjectQueue(QUEUES.NOTIFICATIONS) private readonly notifQueue: Queue) {}

  /** Prevents transmission of improperly stringified interpolation values (e.g., "[object Promise]"). */
  private assertNoUnresolvedArgs(payload: EmailJobPayload): void {
    for (const [key, value] of Object.entries(payload.args)) {
      if (typeof value === 'string' && value.includes('[object ')) {
        throw new Error(
          `Email argument "${key}" contains an unresolved value for template ` +
            `"${payload.template}" - this is a missing await, not content.`,
        );
      }
    }
  }

  /** Prevents accidental exposure of internal identifiers by enforcing non-UUID structures on `Name` fields. */
  private assertNoIdentifiersInNames(payload: EmailJobPayload): void {
    const UUID_SHAPED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const [key, value] of Object.entries(payload.args)) {
      if (key.endsWith('Name') && typeof value === 'string' && UUID_SHAPED.test(value.trim())) {
        throw new Error(
          `Email argument "${key}" is an identifier, not a name, for template ` +
            `"${payload.template}" - a customer must never be shown an internal id.`,
        );
      }
    }
  }

  async send(payload: EmailJobPayload): Promise<void> {
    this.assertNoUnresolvedArgs(payload);
    this.assertNoIdentifiersInNames(payload);

    await this.notifQueue.add(NOTIFICATIONS_JOBS.SEND_EMAIL, payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 50,
      removeOnFail: 100,
    });

    this.logger.debug('Email queued %o', {
      to: payload.to,
      template: payload.template,
      lang: payload.lang,
    });
  }

  /**
   * Enqueues an informational email subject to user opt-out preferences.
   * Throws on transactional templates, which strictly require guaranteed delivery.
   */
  async sendUpdate(
    payload: EmailJobPayload,
    prefs: { emailNotifications: boolean } | null,
  ): Promise<EmailOutcome> {
    if (isTransactional(payload.template)) {
      throw new Error(
        `Refusing to route the transactional template "${payload.template}" through sendUpdate. ` +
          `It carries a reference, a deadline, money, an outcome or an action, so a preference ` +
          `must not suppress it. Use send(). If it really is suppressible, add it to ` +
          `SUPPRESSIBLE_TEMPLATES with the reason.`,
      );
    }

    if (prefs && !prefs.emailNotifications) {
      this.logger.log('Update email suppressed by user preference %o', {
        to: payload.to,
        template: payload.template,
      });
      return { status: 'suppressed', reason: 'user-preference' };
    }
    await this.send(payload);
    return { status: 'queued' };
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
