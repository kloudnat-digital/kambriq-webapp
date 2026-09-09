import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { DUNNING_JOBS, QUEUES } from '@kambriq/common';

/**
 * G6 - when the dunning sweep runs.
 *
 * **A BullMQ repeatable job, not `@nestjs/schedule`, and that is the chantier's
 * central decision rather than a packaging preference.**
 *
 * v03: *"Un client SES nul pendant sept mois n'a rien dit. Un paiement oublie ne
 * doit pas pouvoir se taire."* A `@Cron` method that throws writes one line to a
 * log nobody is watching and the schedule carries on as if nothing happened. A
 * repeatable job that throws lands on the queue's **`failed` set**, with its
 * error and its payload, where it stays (`removeOnFailed: 200`) until somebody
 * looks - and where `A18`'s `/health/queues/failed` endpoint can read it from
 * outside the VPC.
 *
 * It also needs no new dependency: `@nestjs/schedule` is not in this repository
 * and `@nestjs/bullmq` is, already carrying four queues.
 *
 * This is a **new file** on purpose. G3's suite asserts that
 * `payments.service.ts` contains no `@Cron`, no `setInterval` and no `repeat:`,
 * and that assertion is not weakened here - it still holds, unmodified, because
 * the schedule lives in this file and the send still lives in that one.
 */
@Injectable()
export class DunningScheduler implements OnModuleInit {
  private readonly logger = new Logger(DunningScheduler.name);

  constructor(
    @InjectQueue(QUEUES.DUNNING) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const pattern = this.config.get<string>('DUNNING_SWEEP_CRON', '0 6 * * *');

    await this.queue.add(
      DUNNING_JOBS.SWEEP,
      {},
      {
        // A fixed id, so restarting the API re-registers the same schedule
        // rather than accumulating one more sweep per deploy.
        jobId: 'dunning-sweep-cron',
        repeat: { pattern },
        removeOnComplete: 10,
        /**
         * Deliberately larger than `removeOnComplete`.
         *
         * The successes are a heartbeat and one is as good as another; the
         * failures are the record of money nobody chased, and they are what
         * this job exists to make visible.
         */
        removeOnFail: 200,
      },
    );

    this.logger.log('Dunning sweep scheduled %o', { pattern });
  }
}
