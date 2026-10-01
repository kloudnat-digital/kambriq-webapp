import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { maskEmail } from '@kambriq/common';
import { CorePrismaService } from '../prisma/core-prisma.service';
import {
  isSnsUrl,
  parseSnsMessage,
  SnsMessageRejected,
  verifySnsSignature,
  type SnsMessage,
} from './sns-message';

export const SES_EVENTS_TOPIC_ARN_VAR = 'SES_EVENTS_TOPIC_ARN';

export type EmailDeliveryKind = 'BOUNCE' | 'COMPLAINT';

/** One stored event: one recipient of one SES bounce or complaint. */
export interface ParsedDeliveryEvent {
  feedbackId: string;
  email: string;
  kind: EmailDeliveryKind;
  type: string | null;
  subType: string | null;
  sesMessageId: string;
  occurredAt: Date;
}

export type EmailEventsOutcome =
  | { type: 'SubscriptionConfirmation'; confirmed: true }
  | { type: 'UnsubscribeConfirmation' }
  | { type: 'Notification'; stored: number; received: number };

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json =>
  value !== null && typeof value === 'object' ? (value as Json) : {};

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const addresses = (recipients: unknown): string[] =>
  (Array.isArray(recipients) ? recipients : [])
    .map((r) => asString(asObject(r)['emailAddress'])?.trim().toLowerCase() ?? '')
    .filter((a) => a.length > 0);

/**
 * Reads an SES event-publishing record (`eventType`) or a feedback notification
 * (`notificationType`). Anything other than a bounce or a complaint yields no
 * rows: the configuration set publishes only those two, and anything else is
 * acknowledged so SNS does not retry it.
 */
export const parseSesEvent = (message: string): ParsedDeliveryEvent[] => {
  let event: Json;
  try {
    event = asObject(JSON.parse(message));
  } catch {
    throw new SnsMessageRejected('The SES event is not JSON.');
  }
  const kind = asString(event['eventType']) ?? asString(event['notificationType']) ?? '';
  const sesMessageId = asString(asObject(event['mail'])['messageId']) ?? '';

  if (kind === 'Bounce') {
    const b = asObject(event['bounce']);
    return addresses(b['bouncedRecipients']).map((email) => ({
      feedbackId: String(b['feedbackId']),
      email,
      kind: 'BOUNCE',
      type: asString(b['bounceType']),
      subType: asString(b['bounceSubType']),
      sesMessageId,
      occurredAt: new Date(String(b['timestamp'])),
    }));
  }
  if (kind === 'Complaint') {
    const c = asObject(event['complaint']);
    return addresses(c['complainedRecipients']).map((email) => ({
      feedbackId: String(c['feedbackId']),
      email,
      kind: 'COMPLAINT',
      type: asString(c['complaintFeedbackType']),
      subType: null,
      sesMessageId,
      occurredAt: new Date(String(c['timestamp'])),
    }));
  }
  return [];
};

/**
 * C24 - receives SES bounce and complaint events from the SNS topic of the
 * API's configuration set, and records them against the address and, when it
 * belongs to one, the account.
 *
 * A delivery is believed only when its SNS signature verifies and it comes from
 * the configured topic. An absent topic refuses every delivery with a 503: it is
 * not a permissive mode. Replays are harmless by construction, because an event
 * is unique on its SES feedback id and address.
 */
@Injectable()
export class EmailEventsService {
  private readonly logger = new Logger(EmailEventsService.name);
  private readonly certificates = new Map<string, string>();

  constructor(
    private readonly prisma: CorePrismaService,
    private readonly config: ConfigService,
  ) {}

  async receive(body: unknown): Promise<EmailEventsOutcome> {
    const topic = this.config.get<string>(SES_EVENTS_TOPIC_ARN_VAR)?.trim();
    if (!topic) {
      this.logger.error(
        `${SES_EVENTS_TOPIC_ARN_VAR} is not set. Refusing every SES event delivery.`,
      );
      throw new ServiceUnavailableException('SES events are not configured.');
    }

    let message: SnsMessage;
    try {
      message = parseSnsMessage(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    try {
      await verifySnsSignature(message, (url) => this.certificate(url));
    } catch (e) {
      if (e instanceof SnsMessageRejected) throw new UnauthorizedException(e.message);
      throw e;
    }

    if (message.TopicArn !== topic) {
      throw new ForbiddenException('The delivery is not from the SES events topic.');
    }

    switch (message.Type) {
      case 'SubscriptionConfirmation':
        return this.confirm(message);
      case 'UnsubscribeConfirmation':
        this.logger.warn(`SES events topic unsubscribed this endpoint: ${message.TopicArn}`);
        return { type: 'UnsubscribeConfirmation' };
      case 'Notification':
        return this.record(message.Message);
    }
  }

  /** Stores each recipient's event once; returns how many rows were new. */
  async record(sesEvent: string): Promise<EmailEventsOutcome> {
    let events: ParsedDeliveryEvent[];
    try {
      events = parseSesEvent(sesEvent);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    if (events.length === 0) return { type: 'Notification', stored: 0, received: 0 };

    const users = await this.prisma.user.findMany({
      where: { email: { in: events.map((e) => e.email), mode: 'insensitive' } },
      select: { id: true, email: true },
    });
    const owner = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));

    const { count } = await this.prisma.emailDeliveryEvent.createMany({
      data: events.map((e) => ({ ...e, userId: owner.get(e.email) ?? null })),
      skipDuplicates: true,
    });

    for (const e of events) {
      this.logger.warn(
        `SES ${e.kind} ${e.type ?? ''}/${e.subType ?? ''} for ${maskEmail(e.email)} ` +
          `messageId=${e.sesMessageId} account=${owner.get(e.email) ?? 'none'}`,
      );
    }
    return { type: 'Notification', stored: count, received: events.length };
  }

  private async confirm(message: SnsMessage): Promise<EmailEventsOutcome> {
    if (!isSnsUrl(message.SubscribeURL)) {
      throw new UnauthorizedException('The subscription URL is not served by SNS.');
    }
    const res = await fetch(message.SubscribeURL as string, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new BadGatewayException(`SNS refused the confirmation: ${res.status}`);
    this.logger.log(`Confirmed the SES events subscription for ${message.TopicArn}`);
    return { type: 'SubscriptionConfirmation', confirmed: true };
  }

  /** The PEM at an SNS certificate URL, fetched once per URL. */
  protected async certificate(url: string): Promise<string> {
    const cached = this.certificates.get(url);
    if (cached) return cached;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok)
      throw new SnsMessageRejected(`The signing certificate could not be read: ${res.status}`);
    const pem = await res.text();
    this.certificates.set(url, pem);
    return pem;
  }
}
