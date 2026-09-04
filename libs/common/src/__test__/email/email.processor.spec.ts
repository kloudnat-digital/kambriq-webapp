import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { I18nService } from 'nestjs-i18n';
import type { Job } from 'bullmq';

// The SDK is stubbed so the assertions are about how we construct and call it.
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: jest.fn().mockImplementation((config: unknown) => ({
    config,
    send: mockSend,
  })),
  SendEmailCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
}));

// Templates need i18n and are not what these tests are about.
jest.mock('../../email/templates', () => ({
  buildEmail: jest.fn(() => ({
    subject: 'Verify your email',
    html: '<p>Hello Alice</p>',
  })),
}));

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { EmailProcessor } from '../../email/email.processor';
import { NOTIFICATIONS_JOBS } from '../../constants/queue';
import type { EmailJobPayload } from '../../email/email.service';

const SESv2ClientMock = SESv2Client as unknown as jest.Mock;
const SendEmailCommandMock = SendEmailCommand as unknown as jest.Mock;

const makeConfig = (values: Record<string, string> = {}) =>
  ({
    get: jest.fn((key: string, fallback?: string) => (key in values ? values[key] : fallback)),
  }) as unknown as ConfigService;

const makeProcessor = (values: Record<string, string> = {}) =>
  new EmailProcessor(makeConfig(values), {} as I18nService);

const sendJob = {
  name: NOTIFICATIONS_JOBS.SEND_EMAIL,
  data: {
    to: 'alice@example.com',
    lang: 'fr',
    template: 'verification',
    args: { firstName: 'Alice' },
  },
} as unknown as Job<EmailJobPayload>;

beforeEach(() => {
  jest.clearAllMocks();
  mockSend.mockResolvedValue({ MessageId: 'ses-message-id-123' });
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('EmailProcessor: client construction', () => {
  // The bug this whole change exists to remove: the client was only built when
  // AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY were both present. They are
  // never set in the ECS task definition, so on Fargate it was never built and
  // every email silently became a console log.
  it('constructs the SES client when no static credentials are present', () => {
    makeProcessor({ AWS_REGION: 'eu-central-1' });

    expect(SESv2ClientMock).toHaveBeenCalledTimes(1);
    expect(SESv2ClientMock).toHaveBeenCalledWith({ region: 'eu-central-1' });
  });

  it('passes no credentials, leaving the default provider chain to resolve them', () => {
    makeProcessor({ AWS_REGION: 'eu-central-1' });

    const config = SESv2ClientMock.mock.calls[0][0] as Record<string, unknown>;
    expect(config).not.toHaveProperty('credentials');
  });

  it('ignores static credentials even when they are set', () => {
    makeProcessor({
      AWS_REGION: 'eu-central-1',
      AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE',
      AWS_SECRET_ACCESS_KEY: 'secret',
    });

    const config = SESv2ClientMock.mock.calls[0][0] as Record<string, unknown>;
    expect(config).toEqual({ region: 'eu-central-1' });
  });

  it('defaults the region to eu-central-1, never eu-west-3', () => {
    makeProcessor({});
    expect(SESv2ClientMock).toHaveBeenCalledWith({ region: 'eu-central-1' });
  });
});

describe('EmailProcessor: sending', () => {
  it('sends with FromEmailAddress built from the configured name and address', async () => {
    const processor = makeProcessor({
      EMAIL_FROM: 'noreply@kambriq.com',
      EMAIL_FROM_NAME: 'KAMBRIQ',
    });

    await processor.process(sendJob);

    expect(SendEmailCommandMock).toHaveBeenCalledTimes(1);
    const input = SendEmailCommandMock.mock.calls[0][0] as Record<string, unknown>;
    expect(input['FromEmailAddress']).toBe('KAMBRIQ <noreply@kambriq.com>');
    expect(input['Destination']).toEqual({ ToAddresses: ['alice@example.com'] });
  });

  // L1: nestjs-pino treats Logger.log's second argument as the context, so a
  // metadata object is dropped. The MessageId must be in the message itself or
  // there is no record of which send happened.
  it('logs the MessageId in the message text, not a dropped metadata object', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const processor = makeProcessor({});

    await processor.process(sendJob);

    const lines = log.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => l.includes('ses-message-id-123'))).toBe(true);
    expect(lines.some((l) => l.includes('alice@example.com'))).toBe(true);
  });

  it('reports the SES MessageId on success', async () => {
    const processor = makeProcessor({});
    const result = (await processor.process(sendJob)) as Record<string, unknown>;

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      delivered: true,
      messageId: 'ses-message-id-123',
    });
  });
});

describe('EmailProcessor: failure must fail the job', () => {
  // A resolved promise marks the BullMQ job completed. Reporting success while
  // delivering nothing is the failure mode this chantier exists to remove.
  it('rejects when SES fails, so the job fails rather than completing', async () => {
    mockSend.mockRejectedValueOnce(
      Object.assign(new Error('User is not authorized to perform ses:SendEmail'), {
        name: 'AccessDeniedException',
      }),
    );
    const processor = makeProcessor({});

    await expect(processor.process(sendJob)).rejects.toThrow(
      'User is not authorized to perform ses:SendEmail',
    );
  });

  it('does not return a success payload when the send fails', async () => {
    mockSend.mockRejectedValueOnce(new Error('throttled'));
    const processor = makeProcessor({});

    const outcome = await processor.process(sendJob).then(
      (value) => ({ resolved: true, value }),
      () => ({ resolved: false, value: undefined }),
    );

    expect(outcome.resolved).toBe(false);
    expect(outcome.value).toBeUndefined();
  });
});

describe('EmailProcessor: console transport', () => {
  it('is used only when EMAIL_TRANSPORT is explicitly console', async () => {
    const processor = makeProcessor({ EMAIL_TRANSPORT: 'console' });

    expect(SESv2ClientMock).not.toHaveBeenCalled();

    const result = (await processor.process(sendJob)) as Record<string, unknown>;
    expect(mockSend).not.toHaveBeenCalled();
    expect(result).toMatchObject({ delivered: false, transport: 'console' });
  });

  it.each([
    ['unset', {}],
    ['ses', { EMAIL_TRANSPORT: 'ses' }],
    ['an unrecognised value', { EMAIL_TRANSPORT: 'smtp' }],
  ])('sends through SES when EMAIL_TRANSPORT is %s', async (_label, values) => {
    const processor = makeProcessor(values as Record<string, string>);

    expect(SESv2ClientMock).toHaveBeenCalledTimes(1);
    await processor.process(sendJob);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  // The regression guard: absent credentials must no longer silently downgrade
  // the transport to console.
  it('does not fall back to console when credentials are absent', async () => {
    const processor = makeProcessor({ AWS_REGION: 'eu-central-1' });

    await processor.process(sendJob);

    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
