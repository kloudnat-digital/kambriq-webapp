import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { I18nService } from 'nestjs-i18n';
import type { Job } from 'bullmq';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  SendEmailCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
}));

jest.mock('../../email/templates', () => ({
  ...jest.requireActual('../../email/templates'),
  buildEmail: jest.fn(() => ({ subject: 'Subject', html: '<p>Body</p>' })),
}));

import { EmailProcessor } from '../../email/email.processor';
import { EmailService, type EmailJobPayload } from '../../email/email.service';
import { NOTIFICATIONS_JOBS, QUEUES } from '../../constants/queue';
import { mockQueue } from '../utils/mocks';

/**
 * C43 - the email paths write no recipient address in clear.
 *
 * A log line is kept for days and read by whoever can read the log group; the
 * recipient is identified by its masked form (`al***@example.com`), which is
 * enough to correlate and is not the address. Every argument of every logger
 * call is collected, because an address can arrive through a template, an
 * object, or a third party's error message.
 */
const ADDRESS = 'alice.martin@example.com';
const CLEAR = /alice\.martin@example\.com/;

const logged = (): string =>
  (['log', 'warn', 'error', 'debug', 'verbose'] as const)
    .flatMap((level) =>
      (Logger.prototype[level] as unknown as jest.Mock).mock.calls
        .flat()
        .map((a) => (typeof a === 'string' ? a : JSON.stringify(a))),
    )
    .join('\n');

const makeProcessor = (values: Record<string, string>) =>
  new EmailProcessor(
    {
      get: jest.fn((key: string, fallback?: string) => (key in values ? values[key] : fallback)),
    } as unknown as ConfigService,
    {} as I18nService,
  );

const job = {
  name: NOTIFICATIONS_JOBS.SEND_EMAIL,
  data: { to: ADDRESS, lang: 'fr', template: 'verification', args: {} },
} as unknown as Job<EmailJobPayload>;

beforeEach(() => {
  jest.clearAllMocks();
  for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
    jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined);
  }
});

afterEach(() => jest.restoreAllMocks());

describe('C43 - the email processor', () => {
  const ses = { AWS_REGION: 'eu-central-1', SES_CONFIGURATION_SET: 'kambriq-test-api' };

  it('logs a delivered message without the address in clear', async () => {
    mockSend.mockResolvedValue({ MessageId: 'ses-id' });
    await makeProcessor(ses).process(job);

    expect(logged()).toContain('al***@example.com');
    expect(logged()).not.toMatch(CLEAR);
  });

  it('logs a refused send without the address, even inside the provider error', async () => {
    mockSend.mockRejectedValue(
      new Error(`Email address is not verified. The following identities failed: ${ADDRESS}`),
    );
    await expect(makeProcessor(ses).process(job)).rejects.toThrow();

    expect(logged()).toContain('failed');
    expect(logged()).not.toMatch(CLEAR);
  });

  it('logs a console-transport message without the address in clear', async () => {
    await makeProcessor({ EMAIL_TRANSPORT: 'console', SES_CONFIGURATION_SET: 'x' }).process(job);

    expect(logged()).toContain('al***@example.com');
    expect(logged()).not.toMatch(CLEAR);
  });
});

describe('C43 - the email service', () => {
  const build = async () => {
    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: getQueueToken(QUEUES.NOTIFICATIONS), useValue: mockQueue() },
      ],
    }).compile();
    return module.get(EmailService);
  };

  it('logs a queued message without the address in clear', async () => {
    await (await build()).send({ to: ADDRESS, template: 'verification', lang: 'fr', args: {} });

    expect(logged()).toContain('al***@example.com');
    expect(logged()).not.toMatch(CLEAR);
  });

  it('logs a suppressed update without the address in clear', async () => {
    await (
      await build()
    ).sendUpdate(
      { to: ADDRESS, template: 'reservationCreated', lang: 'fr', args: {} },
      { emailNotifications: false },
    );

    expect(logged()).toContain('al***@example.com');
    expect(logged()).not.toMatch(CLEAR);
  });
});
