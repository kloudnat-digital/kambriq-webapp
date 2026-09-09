import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DUNNING_JOBS, QUEUES } from '@kambriq/common';
import { DunningService } from './dunning.service';

/**
 * G6 - runs the dunning sweep.
 *
 * Thin on purpose: the decisions are in `DunningService`, which is unit-testable
 * without Redis. What this adds is the property the chantier is about - **a
 * throw here becomes a durable, readable failure** rather than a log line.
 */
@Processor(QUEUES.DUNNING)
export class DunningProcessor extends WorkerHost {
  private readonly logger = new Logger(DunningProcessor.name);

  constructor(private readonly dunning: DunningService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    /**
     * Refuse, rather than return quietly.
     *
     * This used to sit on `notifications` beside `EmailProcessor` and return
     * `undefined` for anything that was not the sweep - which meant it ATE
     * reminder emails whenever it won the job, leaving no failure and no log.
     * It has its own queue now, so nothing else should ever arrive here; if
     * something does, that is a wiring mistake and must be loud.
     */
    if (job.name !== DUNNING_JOBS.SWEEP) {
      throw new Error(
        `${job.name} was queued on '${QUEUES.DUNNING}', which only runs ` +
          `'${DUNNING_JOBS.SWEEP}'. Refusing to silently discard it.`,
      );
    }

    this.logger.log('Dunning sweep starting %o', { jobId: job.id });

    /**
     * Not wrapped in a try/catch, and that is the point.
     *
     * `DunningService.sweep` throws `DunningSweepError` when any payment failed
     * to be reminded or expired, carrying the tally and every failure. Catching
     * it here to "keep the schedule healthy" would restore precisely the silence
     * this chantier exists to remove: the job would go green while money sat
     * unchased. Let it reach the `failed` set.
     */
    return await this.dunning.sweep();
  }
}
