import { ConfigService } from '@nestjs/config';
import { SELECTABLE_CHANNELS } from '@kambriq/common';
import {
  CHANNEL_FIELDS,
  PaymentChannelsService,
} from '../../../lands/payments/payment-channels.service';

/**
 * G8 blocker, G12's rule enforced where it can fail: only the chosen channel's
 * details ever leave.
 *
 * `payment-instructions.spec.ts` proves `sendInstructions` asks for ONE channel,
 * but it mocks `detailsFor`, so nothing proved what `detailsFor` itself hands
 * back. Here the real service answers, with every channel's parameters present -
 * the worst case, where a leak would have something to leak - and each answer
 * must hold exactly its own channel's fields and not one value belonging to
 * another channel.
 */
const EVERY_VALUE: Record<string, string> = Object.fromEntries(
  [...new Set(Object.values(CHANNEL_FIELDS).flat())].map((f) => [f, `value-of-${f}`]),
);

/**
 * KAMBRIQ's own support contact rides on every message, by design
 * (`detailsFor`): somebody who cannot make a channel work needs a number to
 * call, whichever channel it is. It is not a payment coordinate, and it is the
 * only thing besides the chosen channel's own fields that may leave. Named here
 * rather than inferred, so widening it is a visible edit.
 */
const SUPPORT_CONTACT = ['supportEmail', 'supportPhone'];

const service = () => {
  const s = new PaymentChannelsService({ get: () => undefined } as unknown as ConfigService);
  jest.spyOn(s, 'get').mockResolvedValue(EVERY_VALUE as never);
  jest
    .spyOn(s as unknown as { optional: () => Promise<Record<string, string>> }, 'optional')
    .mockResolvedValue(EVERY_VALUE);
  return s;
};

describe('G8 - only the chosen channel leaves', () => {
  it('knows every channel a person may choose', () => {
    for (const channel of SELECTABLE_CHANNELS) expect(CHANNEL_FIELDS[channel]).toBeDefined();
  });

  it.each(SELECTABLE_CHANNELS.map((c) => [c]))(
    '%s: exactly its own fields, and no value of any other channel',
    async (channel) => {
      const details = await service().detailsFor(channel);

      const allowed = new Set([...CHANNEL_FIELDS[channel], ...SUPPORT_CONTACT]);
      expect(Object.keys(details).sort()).toEqual([...allowed].sort());

      const otherChannelsPaymentFields = Object.entries(CHANNEL_FIELDS)
        .filter(([other]) => other !== channel)
        .flatMap(([, fields]) => fields)
        .filter((field) => !allowed.has(field));
      for (const field of otherChannelsPaymentFields) {
        expect(Object.values(details)).not.toContain(EVERY_VALUE[field]);
      }
    },
  );
});
