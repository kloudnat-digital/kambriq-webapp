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

  constructor(@InjectQueue(QUEUES.NOTIFICATIONS) private readonly notifQueue: Queue) {}

  /**
   * An interpolation argument that stringifies to `[object Promise]` or
   * `[object Object]` is always a defect, never content. It is what a missing
   * `await` looks like by the time it reaches a template: the send succeeds,
   * SES delivers, the user receives the mail, and the link in it is dead. That
   * failure is invisible from every side except the recipient's.
   *
   * `${await f()}` and `${f()}` differ by five characters and nothing in the
   * type system separates them - both produce a `string`. So the check is here,
   * at the one place every template argument passes through, and it throws
   * rather than warns: an auth email with a dead link is worse than no email.
   */
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

  /**
   * A field called `…Name` must not carry an identifier.
   *
   * `clientPortalAccess` was sent with `agentName: agentUserId` and the comment
   * "will be enriched in the controller". It never was, so clients received
   * **"Votre agent KAMNET : 00000000-0000-4000-8000-b00000000005"** — a UUID
   * where a person's name belongs. A leak and an embarrassment in one line.
   *
   * The check lives here for the same reason the `[object …]` one does: this is
   * the single place every template argument passes through, so it covers
   * templates nobody has written yet. It is deliberately narrow — only fields
   * whose name ends in `Name`, only values shaped like a UUID. No human is
   * called `00000000-0000-4000-8000-b00000000005`.
   */
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
   * Send an informational update email, respecting the recipient's opt-out.
   * Use this for state-change / progress / achievement notifications.
   * NEVER use this for auth, security, compliance or onboarding emails —
   * those must always reach the user regardless of preference.
   */
  async sendUpdate(
    payload: EmailJobPayload,
    prefs: { emailNotifications: boolean } | null,
  ): Promise<void> {
    if (prefs && !prefs.emailNotifications) {
      this.logger.debug('Update email skipped by user preference %o', {
        to: payload.to,
        template: payload.template,
      });
      return;
    }
    return this.send(payload);
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
