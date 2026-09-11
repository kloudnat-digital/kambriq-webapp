import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ContactRequestStatus,
  ContactSubject,
  EmailService,
  SupportedLanguage,
  formatHumanDate,
  formatHumanDateTime,
  maskEmail,
} from '@kambriq/common';
import { CorePrismaService } from '../prisma/core-prisma.service';

export type SubmitContactRequestInput = {
  name: string;
  email: string;
  phone?: string;
  subject: ContactSubject;
  message: string;
  locale: 'fr' | 'en';
  consent: boolean;
  /** The privacy policy the consent text pointed at, as the page rendered it. */
  consentPolicyPath: string;
};

/** Thrown when a request arrives without consent. Never a silent drop. */
export class ConsentRequiredError extends Error {
  constructor() {
    super(
      'Refusing to store a contact request without consent. The checkbox, the DTO and the ' +
        'NOT NULL column each refuse it; this is the layer that refuses a caller who went ' +
        'round the DTO.',
    );
    this.name = 'ConsentRequiredError';
  }
}

/**
 * Thrown by the digest when it has nowhere to send.
 *
 * It **throws** rather than logging, unlike the per-request notification, and
 * the difference is the point. A request that cannot be announced is still
 * stored and still surfaces in the next digest. A digest that cannot be sent
 * has no later mechanism to catch it, so it must land on the queue's failed set
 * where `/health/queues/failed` can read it.
 */
export class DigestUndeliverableError extends Error {
  constructor() {
    super(
      'CONTACT_INBOX_EMAIL is not set, so the daily contact digest has nowhere to go. ' +
        'Failing rather than resolving: a digest that quietly does not send is exactly the ' +
        'silence it exists to make impossible.',
    );
    this.name = 'DigestUndeliverableError';
  }
}

/** The window the digest counts. 48 h, so a missed day is still covered. */
export const DIGEST_WINDOW_HOURS = 48;

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly prisma: CorePrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Stores an inbound request, then announces it.
   *
   * ---------------------------------------------------------------------------
   * The write is the success criterion, and nothing else is
   * ---------------------------------------------------------------------------
   * The prospect is told "sent" only when the row exists. The two emails are
   * enqueued afterwards and **their failure does not fail the request**: the
   * lead is already safe, and returning an error at that point would tell a
   * person who wrote three paragraphs that nothing arrived, so they would send
   * them again and we would hold the same lead twice.
   *
   * That is only defensible because a lost notification cannot go unnoticed:
   * the daily digest counts **rows**, not emails, so a request whose
   * notification never went out is still in tomorrow's count. Without the
   * digest this would be a silent failure, and with it, it is a delayed one.
   */
  async submit(input: SubmitContactRequestInput): Promise<{ id: string; reference: string }> {
    if (input.consent !== true) throw new ConsentRequiredError();

    /**
     * The server's clock, never the browser's. A consent timestamp supplied by
     * a caller is a claim about the past; this is a record of an event.
     */
    const consentGivenAt = new Date();

    const created = await this.prisma.contactRequest.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        subject: input.subject,
        message: input.message,
        locale: input.locale,
        consentGivenAt,
        consentPolicyPath: input.consentPolicyPath,
      },
    });

    const reference = this.referenceOf(created.id);

    // The address is masked and the message is not logged at all: this is
    // somebody's enquiry, and the row is the place it belongs.
    this.logger.log('Contact request stored %o', {
      id: created.id,
      reference,
      subject: input.subject,
      locale: input.locale,
      email: maskEmail(input.email),
    });

    await this.announce({ ...input, id: created.id, reference, consentGivenAt });

    return { id: created.id, reference };
  }

  /**
   * The two messages: one to the back office, one to the prospect.
   *
   * Never throws. Every failure is logged at `error` with the reference, so the
   * row can be found and answered by hand, and the digest counts it regardless.
   */
  private async announce(request: {
    id: string;
    reference: string;
    name: string;
    email: string;
    phone?: string;
    subject: ContactSubject;
    message: string;
    locale: 'fr' | 'en';
    consentGivenAt: Date;
  }): Promise<void> {
    const backOfficeLang = this.backOfficeLocale();
    const locale = ContactService.localeTag(backOfficeLang);
    const inbox = this.config.get<string>('CONTACT_INBOX_EMAIL');

    if (!inbox) {
      /**
       * Loud, and it names the variable.
       *
       * A degraded path must be an explicit setting, never an inference from
       * absent configuration - the rule the SES client broke for seven months.
       * There is no fallback to `EMAIL_FROM` here on purpose: guessing an
       * address is how a lead ends up in a mailbox nobody reads.
       */
      this.logger.error(
        `Contact request ${request.reference} was stored but NOT announced: ` +
          `CONTACT_INBOX_EMAIL is not set. Set it from SSM. The request is safe in the ` +
          `database and will appear in the next daily digest.`,
      );
    } else {
      await this.trySend(request.reference, 'back-office notification', () =>
        this.email.send({
          to: inbox,
          template: 'contactRequestNotification',
          lang: backOfficeLang,
          args: {
            reference: request.reference,
            name: request.name,
            email: request.email,
            phone: request.phone ?? this.noneLabel(backOfficeLang),
            subject: request.subject,
            subjectLabel: request.subject,
            locale: request.locale,
            message: request.message,
            // Human dates, not ISO strings. G3 shipped a payment deadline as
            // "2026-10-06" and it was read by a person before it was found;
            // this is the same message surface and the same rule.
            receivedAt: formatHumanDateTime(request.consentGivenAt, locale),
            consentGivenAt: formatHumanDateTime(request.consentGivenAt, locale),
          },
        }),
      );
    }

    await this.trySend(request.reference, 'prospect acknowledgement', () =>
      this.email.send({
        to: request.email,
        // In the language of the page they filled in, which is why the row
        // stores it. Not the browser's Accept-Language, and not a guess from
        // the address.
        lang: request.locale,
        template: 'contactRequestReceived',
        args: {
          reference: request.reference,
          name: request.name,
          subjectLabel: request.subject,
          message: request.message,
        },
      }),
    );
  }

  /**
   * L2 - the daily digest. **Sent every day, zero included.**
   *
   * An alert that fires on a condition is a mechanism nobody has ever watched
   * work; this one arrives whatever the count, so its **absence** is the alarm.
   * The count is over rows, so it also covers a request whose notification
   * email was lost.
   */
  async sendDailyDigest(now: Date = new Date()): Promise<{
    count: number;
    pending: number;
    sentTo: string;
  }> {
    const inbox = this.config.get<string>('CONTACT_INBOX_EMAIL');
    if (!inbox) throw new DigestUndeliverableError();

    const since = new Date(now.getTime() - DIGEST_WINDOW_HOURS * 3_600_000);
    const lang = this.backOfficeLocale();
    const locale = ContactService.localeTag(lang);

    const [recent, pending, oldest] = await Promise.all([
      this.prisma.contactRequest.findMany({
        where: { createdAt: { gte: since, lte: now } },
        select: { subject: true },
      }),
      this.prisma.contactRequest.count({ where: { status: ContactRequestStatus.NEW } }),
      this.prisma.contactRequest.findFirst({
        where: { status: ContactRequestStatus.NEW },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    const bySubject = new Map<string, number>();
    for (const row of recent) bySubject.set(row.subject, (bySubject.get(row.subject) ?? 0) + 1);

    await this.email.send({
      to: inbox,
      template: 'contactDigest',
      lang,
      args: {
        count: recent.length,
        // Read by a person over their first coffee, so: dates a person reads.
        since: formatHumanDate(since, locale),
        until: formatHumanDate(now, locale),
        pending,
        oldest: oldest
          ? `${Math.floor((now.getTime() - oldest.createdAt.getTime()) / 86_400_000)} ${
              lang === 'en' ? 'day(s)' : 'jour(s)'
            }`
          : this.noneLabel(lang),
        breakdown:
          [...bySubject.entries()].map(([subject, n]) => `${subject}: ${n}`).join('\n') ||
          this.noneLabel(lang),
      },
    });

    this.logger.log('Contact digest sent %o', {
      count: recent.length,
      pending,
      windowHours: DIGEST_WINDOW_HOURS,
    });

    return { count: recent.length, pending, sentTo: inbox };
  }

  /**
   * A short, sayable reference for one request.
   *
   * Derived from the row's own id rather than from a second counter: there is
   * nothing to keep in step, and a prospect who quotes it can be found in one
   * query. Deliberately **not** the payment reference format - that one carries
   * a check character because it is dictated onto a transfer slip and a wrong
   * digit moves money. This is only ever read back to us over email.
   */
  private referenceOf(id: string): string {
    return `KBQ-C-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }

  private backOfficeLocale(): SupportedLanguage {
    return this.config.get<string>('CONTACT_BACKOFFICE_LOCALE', 'fr') === 'en' ? 'en' : 'fr';
  }

  /** The BCP-47 tag the date formatters take, from a language code. */
  private static localeTag(lang: SupportedLanguage): string {
    return lang === 'en' ? 'en-GB' : 'fr-FR';
  }

  private noneLabel(lang: SupportedLanguage): string {
    return lang === 'en' ? 'None' : 'Aucune';
  }

  /** Runs a send, converts any failure into a loud log, and never rethrows. */
  private async trySend(reference: string, what: string, send: () => Promise<void>): Promise<void> {
    try {
      await send();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Contact request ${reference}: the ${what} could not be queued (${message}). ` +
          `The request itself is stored and will appear in the next daily digest.`,
      );
    }
  }
}
