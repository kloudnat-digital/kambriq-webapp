import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentState,
  PaginationQuery,
  buildPaginatedResponse,
  withOldestWaiting,
  ageInDays,
  ONE_DAY_MS,
  sumReceipts,
} from '@kambriq/common';
import { LandsPrismaService } from '../prisma/lands-prisma.service';
import { CorePrismaService } from '../../core/prisma/core-prisma.service';
import { PaymentsService } from './payments.service';

/**
 * G6 - the dunning queue, the reminders, and the one automatic transition.
 *
 * v03, *"Rien ne peut dormir en silence"*: a payment left in
 * `INSTRUCTIONS_ENVOYEES` past its validity period surfaces in a back-office
 * queue, triggers an automatic reminder, and moves to `EXPIRE` at the term with
 * its reason.
 *
 * The design's own framing is the reason this exists: *"C'est le motif de la
 * semaine du 1er septembre applique a l'argent. Un client SES nul pendant sept
 * mois n'a rien dit. Un paiement oublie ne doit pas pouvoir se taire."*
 */
@Injectable()
export class DunningService {
  private readonly logger = new Logger(DunningService.name);

  constructor(
    private readonly prisma: LandsPrismaService,
    private readonly corePrisma: CorePrismaService,
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * The only state dunning acts on.
   *
   * `INSTRUCTIONS_ENVOYEES` means the client has been told what to pay and how,
   * and has not answered. Every other state is either earlier than that
   * conversation or past it:
   *
   *   - `INITIE` - nobody has been told anything yet; chasing would be chasing
   *     the back office, not the client.
   *   - `ANNONCE_CLIENT` / `EN_VERIFICATION` / `PARTIELLEMENT_RECU` - the client
   *     HAS answered. Money is moving. A reminder here reads as "we lost your
   *     payment" to somebody who has just made one.
   *   - `VALIDE` / `REJETE` / `EXPIRE` / `ANNULE` - terminal. **The queue must
   *     not chase money that has arrived.**
   */
  private static readonly DUNNABLE = PaymentState.INSTRUCTIONS_ENVOYEES;

  /**
   * When reminders fire, in days before the deadline. Default `7,1`.
   *
   * The design says only *"declenche une relance automatique au client"* - one
   * verb, no number - so the number is this chantier's to choose and to justify.
   *
   * **Two, not one.** A single reminder that lands in a spam folder is the
   * seven-months-of-silent-SES failure with better manners: one attempt, no
   * evidence, nobody the wiser. Two independent sends, days apart, is the
   * cheapest thing that stops one lost message being the whole story.
   *
   * **Two, not five.** Every reminder is a transactional email against a
   * reputation this platform has just acquired production SES access for, and a
   * client who has not paid after two is a phone call, not a third email. The
   * back-office queue exists precisely so a person picks that up.
   *
   * **At J-7 and J-1.** `PAYMENT_VALIDITY_DAYS` is 30 because *"un mois est la
   * forme d'un virement de la diaspora"* - an international transfer takes days
   * to clear, so a reminder that arrives the day before the deadline is too late
   * to act on and one that arrives a week before is not. J-7 is the last moment
   * a transfer can still be started and land; J-1 is the last moment anything
   * can be said at all.
   *
   * Configuration, not a literal, so the schedule can be tuned without a deploy
   * and so a test can compress it to make a local end-to-end run possible.
   */
  private reminderOffsets(): number[] {
    const raw = this.config.get<string>('PAYMENT_REMINDER_OFFSETS_DAYS', '7,1');
    const parsed = raw
      .split(',')
      .map((v) => Number.parseInt(v.trim(), 10))
      .filter((n) => Number.isFinite(n) && n >= 0)
      // Largest first: the earliest reminder is the one furthest from the
      // deadline, and a sweep that catches up on a backlog should send the
      // oldest applicable one rather than the newest.
      .sort((a, b) => b - a);

    if (parsed.length === 0) {
      // Not a silent fallback to the default. A misconfigured schedule that
      // quietly becomes "7,1" is a setting that looks applied and is not.
      throw new Error(
        `PAYMENT_REMINDER_OFFSETS_DAYS is "${raw}", which contains no usable day offsets. ` +
          `Expected a comma-separated list of whole days before the deadline, e.g. "7,1".`,
      );
    }
    return parsed;
  }

  /**
   * The back-office queue of payments in souffrance.
   *
   * Oldest first, each row with how long it has been waiting and how far past
   * its deadline it is. Uses the shared aging helpers rather than a third
   * private copy of the same arithmetic - see `queue-aging.ts`.
   */
  /**
   * `now` is injectable, exactly as it is on `sweep`.
   *
   * Not a testing hook bolted on: the two entry points must agree about what
   * "overdue" means, and a queue that reads the wall clock while the sweep is
   * handed one can disagree with it. It also lets a proof run ask "what does
   * this look like the instant after the term" without editing a single row's
   * dates - a run that moves the data to make its assertion true has proved
   * something about the data and nothing about the mechanism.
   */
  async listOverdueQueue(query: PaginationQuery, asOf: Date = new Date()) {
    const { page, limit } = query;
    const now = asOf;

    const where = {
      state: DunningService.DUNNABLE,
      expiresAt: { not: null, lt: now },
    };

    const [rows, total, oldest] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        // Oldest deadline first: the payment that has been overdue longest is
        // the one somebody has to deal with.
        orderBy: { expiresAt: 'asc' },
        include: { receipts: { select: { amount: true } }, reminders: true },
      }),
      this.prisma.payment.count({ where }),
      this.prisma.payment.findFirst({
        where,
        orderBy: { expiresAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    const reservations = rows.length
      ? await this.prisma.landReservation.findMany({
          where: { id: { in: rows.map((p) => p.reservationId) } },
          select: {
            id: true,
            clientName: true,
            clientUserId: true,
            land: { select: { title: true } },
          },
        })
      : [];
    const byId = new Map(reservations.map((r) => [r.id, r]));

    const nowMs = now.getTime();
    const data = rows.map((p) => {
      const reservation = byId.get(p.reservationId);
      const received = sumReceipts(p.receipts);
      return {
        id: p.id,
        reference: p.reference,
        purpose: p.purpose,
        clientName: reservation?.clientName ?? null,
        subject: reservation?.land.title ?? null,
        state: p.state,
        currency: p.currency,
        amountDue: p.amountDue.toString(),
        amountReceived: received.toString(),
        outstanding: (p.amountDue - received).toString(),
        channel: p.channel,
        createdAt: p.createdAt,
        expiresAt: p.expiresAt,
        /** Age of the payment itself, as every other queue reports it. */
        waitingDays: ageInDays(p.createdAt, nowMs),
        /**
         * How far past the deadline, which is the question this queue answers
         * and the other two do not. Never negative: a payment that is not
         * overdue is not in this list at all.
         */
        overdueDays: Math.max(0, ageInDays(p.expiresAt, nowMs) ?? 0),
        remindersSent: p.reminders.length,
        lastReminderAt:
          p.reminders.length > 0
            ? p.reminders.reduce((a, b) => (a.sentAt > b.sentAt ? a : b)).sentAt
            : null,
      };
    });

    return withOldestWaiting(
      buildPaginatedResponse(data, total, page, limit),
      oldest?.createdAt ?? null,
      nowMs,
    );
  }

  /**
   * One pass: send the reminders that are due, then expire what has reached the
   * term. Returns what it did, so the caller can log a number rather than a
   * shrug.
   *
   * Reminders before expiries, deliberately. Doing it the other way round would
   * expire a payment and then find it no longer eligible for the reminder that
   * was due on the same run - the client would be told nothing and then told it
   * had lapsed.
   */
  async sweep(now: Date = new Date()): Promise<{
    remindersSent: number;
    expired: number;
    failures: Array<{ paymentId: string; stage: 'reminder' | 'expire'; error: string }>;
  }> {
    const failures: Array<{ paymentId: string; stage: 'reminder' | 'expire'; error: string }> = [];
    const remindersSent = await this.sendDueReminders(now, failures);
    const expired = await this.expireAtTerm(now, failures);

    const summary = { remindersSent, expired, failures };
    this.logger.log('Dunning sweep complete %o', {
      remindersSent,
      expired,
      failures: failures.length,
    });

    /**
     * A partial failure fails the job.
     *
     * The sweep could return its tally and exit 0 with three failures inside
     * it, and the number would look like a result. It would be the SES defect
     * again: a mechanism reporting success by saying nothing about what did not
     * happen. Throwing puts the job on the queue's `failed` set with this
     * payload attached, where A18's endpoint can read it.
     */
    if (failures.length > 0) {
      throw new DunningSweepError(summary);
    }
    return summary;
  }

  /** Reminders whose moment has come and which have not already been sent. */
  private async sendDueReminders(
    now: Date,
    failures: Array<{ paymentId: string; stage: 'reminder' | 'expire'; error: string }>,
  ): Promise<number> {
    const offsets = this.reminderOffsets();
    const horizonMs = Math.max(...offsets) * ONE_DAY_MS;

    const candidates = await this.prisma.payment.findMany({
      where: {
        state: DunningService.DUNNABLE,
        expiresAt: { not: null, lte: new Date(now.getTime() + horizonMs) },
        reference: { not: null },
      },
      include: { reminders: { select: { offsetDays: true } } },
    });

    let sent = 0;
    for (const payment of candidates) {
      if (!payment.expiresAt) continue;

      const daysLeft = Math.ceil((payment.expiresAt.getTime() - now.getTime()) / ONE_DAY_MS);
      // The earliest offset that has been reached and not yet sent. A payment
      // created after J-7 has passed still gets its J-7 reminder on the first
      // sweep, rather than silently skipping to J-1.
      const already = new Set(payment.reminders.map((r) => r.offsetDays));
      const due = offsets.find((o) => daysLeft <= o && !already.has(o));
      if (due === undefined) continue;

      try {
        const recipient = await this.recipientFor(payment.reservationId);
        if (!recipient) {
          // Not a silent skip. A payment whose client cannot be addressed is a
          // payment nobody can chase, which is exactly what this queue is for.
          throw new Error(
            `no addressable client on reservation ${payment.reservationId}; cannot remind`,
          );
        }

        await this.payments.sendReminder(payment.id, recipient, {
          subject: recipient.subject,
        });

        // Recorded only after the send returned. The other order records a
        // reminder that was never sent and then never sends it again - G3's
        // send-before-transition rule, applied to the reminder ledger.
        await this.prisma.paymentReminder.create({
          data: { paymentId: payment.id, offsetDays: due, deadlineAt: payment.expiresAt },
        });
        sent += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error('Reminder failed %o', {
          paymentId: payment.id,
          offsetDays: due,
          message,
        });
        failures.push({ paymentId: payment.id, stage: 'reminder', error: message });
      }
    }
    return sent;
  }

  /**
   * `EXPIRE` at the term - the one automatic transition the design permits.
   *
   * `G1` deliberately left `EXPIRE` out of `COMMITTING_STATES` so this can run
   * without a named person. Every other committing transition is refused one.
   * The mutation that proves the omission is deliberate rather than accidental
   * is in `dunning.spec.ts`.
   */
  private async expireAtTerm(
    now: Date,
    failures: Array<{ paymentId: string; stage: 'reminder' | 'expire'; error: string }>,
  ): Promise<number> {
    const due = await this.prisma.payment.findMany({
      where: { state: DunningService.DUNNABLE, expiresAt: { not: null, lt: now } },
      select: { id: true, expiresAt: true, reference: true },
    });

    let expired = 0;
    for (const payment of due) {
      try {
        await this.payments.transition(payment.id, PaymentState.EXPIRE, {
          actorUserId: 'system',
          // The reason is not decoration: it is the audit row's "pourquoi", and
          // it names the term rather than saying "expired", which the state
          // already says.
          reason:
            `Validity period elapsed on ${payment.expiresAt?.toISOString().slice(0, 10)} ` +
            `without the announced payment. Expired automatically by the dunning sweep.`,
        });
        expired += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error('Expiry failed %o', { paymentId: payment.id, message });
        failures.push({ paymentId: payment.id, stage: 'expire', error: message });
      }
    }
    return expired;
  }

  /** The client to address, read across the database boundary as everywhere else. */
  private async recipientFor(
    reservationId: string,
  ): Promise<{ email: string; clientName: string; lang: string; subject: string } | null> {
    const reservation = await this.prisma.landReservation.findUnique({
      where: { id: reservationId },
      select: {
        clientName: true,
        clientEmail: true,
        clientUserId: true,
        land: { select: { title: true } },
      },
    });
    if (!reservation) return null;

    let email = reservation.clientEmail ?? null;
    let lang = 'fr';
    if (reservation.clientUserId) {
      const user = await this.corePrisma.user.findUnique({
        where: { id: reservation.clientUserId },
        select: { email: true, preferredLanguage: true },
      });
      if (user?.email) email = user.email;
      if (user?.preferredLanguage) lang = user.preferredLanguage;
    }
    if (!email) return null;

    return {
      email,
      clientName: reservation.clientName ?? '',
      lang,
      subject: reservation.land.title,
    };
  }
}

/**
 * Carries the sweep's tally onto the queue's `failed` set.
 *
 * A bare `Error('sweep failed')` would tell whoever reads the failed job that
 * something went wrong and nothing about what. The payload is the point.
 */
export class DunningSweepError extends Error {
  constructor(
    readonly summary: {
      remindersSent: number;
      expired: number;
      failures: Array<{ paymentId: string; stage: 'reminder' | 'expire'; error: string }>;
    },
  ) {
    super(
      `Dunning sweep finished with ${summary.failures.length} failure(s) ` +
        `(${summary.remindersSent} reminder(s) sent, ${summary.expired} expired): ` +
        summary.failures.map((f) => `${f.paymentId} [${f.stage}] ${f.error}`).join('; '),
    );
    this.name = 'DunningSweepError';
  }
}
