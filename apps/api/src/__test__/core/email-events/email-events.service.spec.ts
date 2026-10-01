import {
  BadRequestException,
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { EmailEventsService, parseSesEvent } from '../../../core/email-events/email-events.service';
import type { CorePrismaService } from '../../../core/prisma/core-prisma.service';
import { PEM, signedNotification } from './sns-fixtures';

const TOPIC = 'arn:aws:sns:eu-central-1:123456789012:example-ses-events';

const bounce = (recipients: string[], feedbackId = 'fb-1') =>
  JSON.stringify({
    eventType: 'Bounce',
    mail: { messageId: 'ses-1', destination: recipients },
    bounce: {
      bounceType: 'Permanent',
      bounceSubType: 'General',
      feedbackId,
      timestamp: '2026-09-28T08:00:01.000Z',
      bouncedRecipients: recipients.map((emailAddress) => ({ emailAddress })),
    },
  });

/** `null` stands for an unset topic; `undefined` would select the default. */
const makeService = (topic: string | null = TOPIC) => {
  const prisma = {
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'u-1', email: 'Ada@Example.com' }]) },
    emailDeliveryEvent: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const config = { get: jest.fn(() => topic ?? undefined) } as unknown as ConfigService;
  const service = new EmailEventsService(prisma as unknown as CorePrismaService, config);
  jest
    .spyOn(service as unknown as { certificate: () => Promise<string> }, 'certificate')
    .mockResolvedValue(PEM);
  return { service, prisma };
};

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('C24 - reading an SES event', () => {
  it('gives one row per bounced recipient, address lowercased', () => {
    expect(parseSesEvent(bounce(['Ada@Example.com', 'b@example.com']))).toEqual([
      expect.objectContaining({ email: 'ada@example.com', kind: 'BOUNCE', type: 'Permanent' }),
      expect.objectContaining({
        email: 'b@example.com',
        feedbackId: 'fb-1',
        sesMessageId: 'ses-1',
      }),
    ]);
  });

  it('reads a complaint', () => {
    const complaint = JSON.stringify({
      eventType: 'Complaint',
      mail: { messageId: 'ses-2' },
      complaint: {
        feedbackId: 'fb-2',
        timestamp: '2026-09-28T08:00:02.000Z',
        complaintFeedbackType: 'abuse',
        complainedRecipients: [{ emailAddress: 'c@example.com' }],
      },
    });
    expect(parseSesEvent(complaint)).toEqual([
      expect.objectContaining({ email: 'c@example.com', kind: 'COMPLAINT', type: 'abuse' }),
    ]);
  });

  it('ignores an event that is neither', () => {
    expect(parseSesEvent(JSON.stringify({ eventType: 'Delivery' }))).toEqual([]);
  });
});

describe('C24 - a delivery reaches the account only through a verified message from the topic', () => {
  it('stores a verified bounce against the account that owns the address, once', async () => {
    const { service, prisma } = makeService();
    const body = JSON.stringify(
      signedNotification({ TopicArn: TOPIC, Message: bounce(['ada@example.com']) }),
    );

    await expect(service.receive(body)).resolves.toEqual({
      type: 'Notification',
      stored: 1,
      received: 1,
    });
    expect(prisma.emailDeliveryEvent.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ email: 'ada@example.com', userId: 'u-1' })],
      skipDuplicates: true,
    });
  });

  it('C43 - logs the bounce with the address masked, never in clear', async () => {
    const { service } = makeService();
    const warn = jest.spyOn(Logger.prototype, 'warn');
    const body = JSON.stringify(
      signedNotification({ TopicArn: TOPIC, Message: bounce(['ada@example.com']) }),
    );

    await service.receive(body);

    const lines = warn.mock.calls.flat().map(String).join('\n');
    expect(lines).toContain('ad***@example.com');
    expect(lines).not.toContain('ada@example.com');
  });

  it('stores an address that belongs to no account with no account', async () => {
    const { service, prisma } = makeService();
    prisma.user.findMany.mockResolvedValue([]);
    await service.record(bounce(['nobody@example.com']));
    expect(prisma.emailDeliveryEvent.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [expect.objectContaining({ userId: null })] }),
    );
  });

  it('refuses every delivery while the topic is not configured', async () => {
    const { service, prisma } = makeService(null);
    await expect(service.receive(JSON.stringify(signedNotification()))).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(prisma.emailDeliveryEvent.createMany).not.toHaveBeenCalled();
  });

  it('refuses a verified message from another topic', async () => {
    const { service, prisma } = makeService();
    const other = signedNotification({ TopicArn: 'arn:aws:sns:eu-central-1:123456789012:other' });
    await expect(service.receive(JSON.stringify(other))).rejects.toThrow(ForbiddenException);
    expect(prisma.emailDeliveryEvent.createMany).not.toHaveBeenCalled();
  });

  it('refuses a message whose signature does not verify', async () => {
    const { service, prisma } = makeService();
    const forged = {
      ...signedNotification({ TopicArn: TOPIC }),
      Message: bounce(['ada@example.com']),
    };
    await expect(service.receive(JSON.stringify(forged))).rejects.toThrow(UnauthorizedException);
    expect(prisma.emailDeliveryEvent.createMany).not.toHaveBeenCalled();
  });

  it('refuses a body that is not an SNS message', async () => {
    const { service } = makeService();
    await expect(service.receive({ Type: 'Notification' })).rejects.toThrow(BadRequestException);
  });

  it('confirms a verified subscription by calling SNS, and only SNS', async () => {
    const { service } = makeService();
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('<ok/>', { status: 200 }));
    const confirmation = (url: string) =>
      JSON.stringify(
        signedNotification({
          Type: 'SubscriptionConfirmation',
          TopicArn: TOPIC,
          SubscribeURL: url,
          Token: 't',
        }),
      );

    await expect(
      service.receive(confirmation('https://sns.eu-central-1.amazonaws.com/?Action=Confirm')),
    ).resolves.toEqual({ type: 'SubscriptionConfirmation', confirmed: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(
      service.receive(confirmation('https://evil.example/?Action=Confirm')),
    ).rejects.toThrow(UnauthorizedException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
