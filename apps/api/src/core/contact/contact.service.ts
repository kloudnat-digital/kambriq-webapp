import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CONSENT_POLICY_SLUG,
  policyInForceWhere,
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

/** Thrown when a contact request arrives without explicit consent. */
export class ConsentRequiredError extends Error {
  constructor() {
    super('Refusing to store a contact request without consent.');
    this.name = 'ConsentRequiredError';
  }
}

/**
 * Thrown when the contact digest cannot be delivered due to missing configuration.
 * Failing ensures the issue is surfaced in health checks.
 */
export class DigestUndeliverableError extends Error {
  constructor() {
    super('CONTACT_INBOX_EMAIL is not set. Cannot send daily contact digest.');
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
   * Stores a contact request in the database and queues notification emails.
   * Email failure does not prevent successful creation.
   */
  async submit(input: SubmitContactRequestInput): Promise<{ id: string; reference: string }> {
    if (input.consent !== true) throw new ConsentRequiredError();

    /** Server-side timestamp for consent auditing. */
    const consentGivenAt = new Date();
    const consentPolicySnapshotId = await this.currentPolicySnapshotId(input.locale);

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
        consentPolicySnapshotId,
      },
    });

    const reference = this.referenceOf(created.id);

    // Mask sensitive PII before logging.
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
   * Sends notifications to the back office and the prospect.
   * Captures and logs errors to prevent failing the contact request submission.
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
      /** Log error if CONTACT_INBOX_EMAIL is not configured, avoiding silent failures. */
      this.logger.error(
        `Contact request ${request.reference} stored but not announced: CONTACT_INBOX_EMAIL is not set.`,
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
    consentsWithoutVersion: number;
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
        select: { subject: true, consentPolicySnapshotId: true },
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

    /**
     * Consents in the window that could not be bound to an archived revision.
     * It rides on the digest for the reason the digest exists: an alert fires on
     * a condition somebody predicted, and this one arrives whatever the number.
     */
    const consentsWithoutVersion = recent.filter((row) => !row.consentPolicySnapshotId).length;

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
        consentsWithoutVersion,
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
      consentsWithoutVersion,
      windowHours: DIGEST_WINDOW_HOURS,
    });

    return { count: recent.length, pending, consentsWithoutVersion, sentTo: inbox };
  }

  /**
   * The archived revision of the privacy policy in force right now, or null.
   *
   * Read from the archive rather than taken from the request: a version supplied
   * by a browser is a claim about what somebody was shown, and the record has to
   * say what the site was serving. Same reasoning as the consent timestamp.
   *
   * Null when nothing has been archived for that language, which is the state
   * until a policy is published. The request is still stored - the lead is the
   * success criterion - and the gap is reported here and counted in the digest,
   * so it is a number somebody reads rather than an empty column.
   */
  private async currentPolicySnapshotId(locale: 'fr' | 'en'): Promise<string | null> {
    const snapshot = await this.prisma.policySnapshot.findFirst({
      // C41: in force means already published; a revision dated in the future
      // is not what anybody consents to today. With none in force, the consent
      // records no revision rather than one it was not given against.
      where: policyInForceWhere(CONSENT_POLICY_SLUG, locale, new Date()),
      orderBy: { publishedAt: 'desc' },
      select: { id: true },
    });

    if (!snapshot) {
      this.logger.error(
        `No archived revision of ${CONSENT_POLICY_SLUG} in ${locale}: this consent records the ` +
          'document and not the wording. Publish the policy in the Studio so the webhook archives it.',
      );
      return null;
    }

    return snapshot.id;
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
