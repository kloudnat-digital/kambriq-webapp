import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Logger } from '@nestjs/common';
import { MetadataScanner, Reflector } from '@nestjs/core';
import { BullMetadataAccessor } from '@nestjs/bullmq/dist/bull-metadata.accessor';
import type { Job } from 'bullmq';
import { LoudWorkerHost } from '@kambriq/common';
import { CoreCleanupProcessor } from '../../core/cleanup/cleanup.processor';
import { KamnetProcessor } from '../../kamnet/processors/kamnet.processor';
import { KbsGradingProcessor } from '../../kbs/exam/grading-processor';
import { DunningProcessor } from '../../lands/payments/dunning.processor';

/**
 * A54 - a queue job that fails writes an error-level line.
 *
 * The contact digest failed every morning on dev for weeks and the log held
 * nothing: BullMQ keeps a failed job in Redis and says nothing, so the failure
 * was visible only to somebody asking `/health/queues` (A18). A18 made queue
 * state readable on request; this makes a failure announce itself.
 */

/** The handlers `BullExplorer.registerWorkerEventListeners` would attach, found the way it finds them. */
const workerEventsOf = (Processor: abstract new (...args: never[]) => object) => {
  const instance = Object.create(Processor.prototype) as Record<string, unknown>;
  const accessor = new BullMetadataAccessor(new Reflector());
  const events: string[] = [];
  new MetadataScanner().scanFromPrototype(instance, Object.getPrototypeOf(instance), (key) => {
    const meta = accessor.getOnWorkerEventMetadata(instance[key] as () => void);
    if (meta) events.push(meta.eventName);
  });
  return events;
};

describe('A54 - every processor announces a failed job', () => {
  it.each([
    ['CoreCleanupProcessor', CoreCleanupProcessor],
    ['KamnetProcessor', KamnetProcessor],
    ['KbsGradingProcessor', KbsGradingProcessor],
    ['DunningProcessor', DunningProcessor],
  ] as const)('%s: the explorer finds a "failed" handler', (_name, Processor) => {
    expect(workerEventsOf(Processor)).toContain('failed');
  });

  it('writes one error line with the queue, job and error, and never the payload', () => {
    class Probe extends LoudWorkerHost {
      async process() {
        return undefined;
      }
    }
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const job = {
      queueName: 'core',
      name: 'core.contact-digest',
      id: 'repeat:abc:1790406000000',
      attemptsMade: 1,
      opts: { attempts: 1 },
      data: { email: 'someone@example.test' },
    } as unknown as Job;

    (Object.create(Probe.prototype) as Probe).onFailed.call(
      new Probe(),
      job,
      new Error('CONTACT_INBOX_EMAIL is not set. Cannot send daily contact digest.'),
    );

    // Exact fields and a single call: the payload's address has nowhere to ride.
    expect(error).toHaveBeenCalledTimes(1);
    const [message, fields] = error.mock.calls[0] as [string, Record<string, unknown>];
    expect(message).toBe('Queue job failed %o');
    expect(fields).toEqual({
      queue: 'core',
      job: 'core.contact-digest',
      id: 'repeat:abc:1790406000000',
      attempt: 1,
      maxAttempts: 1,
      error: 'CONTACT_INBOX_EMAIL is not set. Cannot send daily contact digest.',
    });
    error.mockRestore();
  });
});

/**
 * Found by reading the source, so a processor added tomorrow is covered the
 * day it is written.
 */
describe('A54 - no processor can be written without it', () => {
  const ROOTS = [
    join(__dirname, '../../..', 'src'),
    join(__dirname, '../../../../../libs/common/src'),
  ];
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
    );
  const processors = ROOTS.flatMap(walk)
    .filter((f) => f.endsWith('.ts') && !/\.(spec|dbspec)\.ts$/.test(f) && !f.includes('__test__'))
    .map((f) => ({ f, src: readFileSync(f, 'utf8') }))
    .filter(({ src }) => /^@Processor\(/m.test(src));

  it('finds the five processors', () => {
    expect(processors).toHaveLength(5);
  });

  it.each(processors.map(({ f, src }) => [relative(join(__dirname, '../../../../..'), f), src]))(
    '%s extends LoudWorkerHost',
    (_file, src) => {
      const base = /^export class \w+ extends (\w+)/m.exec(src)?.[1];
      expect(base).toBe('LoudWorkerHost');
    },
  );
});
