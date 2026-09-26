import { MetadataScanner, Reflector } from '@nestjs/core';
import { BullMetadataAccessor } from '@nestjs/bullmq/dist/bull-metadata.accessor';
import { EmailProcessor } from '../../email/email.processor';

/**
 * A54 - the notifications processor lives in this library, so its half of
 * "every processor announces a failed job" is proved here: the handler
 * `BullExplorer` would attach, found the way it finds it.
 */
describe('A54 - EmailProcessor announces a failed job', () => {
  it('the explorer finds a "failed" handler', () => {
    const instance = Object.create(EmailProcessor.prototype) as Record<string, unknown>;
    const accessor = new BullMetadataAccessor(new Reflector());
    const events: string[] = [];
    new MetadataScanner().scanFromPrototype(instance, Object.getPrototypeOf(instance), (key) => {
      const meta = accessor.getOnWorkerEventMetadata(instance[key] as () => void);
      if (meta) events.push(meta.eventName);
    });
    expect(events).toContain('failed');
  });
});
