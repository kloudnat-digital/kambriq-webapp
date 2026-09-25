import { ConflictException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: jest.fn().mockImplementation((config: unknown) => ({
    config,
    send: mockSend,
  })),
  CreateContactCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
}));

import { SESv2Client, CreateContactCommand } from '@aws-sdk/client-sesv2';
import {
  NewsletterConsentRequiredError,
  NewsletterService,
  type SubscribeNewsletterInput,
} from '../../newsletter/newsletter.service';

const SESv2ClientMock = SESv2Client as unknown as jest.Mock;
const CreateContactCommandMock = CreateContactCommand as unknown as jest.Mock;

const makeService = (values: Record<string, string> = {}) =>
  new NewsletterService({
    get: jest.fn((key: string, fallback?: string) => (key in values ? values[key] : fallback)),
  } as unknown as ConfigService);

const named = (name: string, message = name) => Object.assign(new Error(message), { name });

/** A subscription as the controller hands it over. */
const subscription = (email: string, over: Partial<SubscribeNewsletterInput> = {}) =>
  ({
    email,
    locale: 'fr',
    consent: true,
    consentPolicyPath: '/legal/privacy',
    ...over,
  }) as SubscribeNewsletterInput;

/** The attributes stored on the SES contact, parsed back from the command. */
const storedAttributes = () =>
  JSON.parse(
    (CreateContactCommandMock.mock.calls[0][0] as { AttributesData: string }).AttributesData,
  ) as Record<string, unknown>;

beforeEach(() => {
  jest.clearAllMocks();
  mockSend.mockResolvedValue({});
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('NewsletterService: client construction', () => {
  it('constructs the SES client when no static credentials are present', () => {
    makeService({ AWS_REGION: 'eu-central-1' });

    expect(SESv2ClientMock).toHaveBeenCalledTimes(1);
    expect(SESv2ClientMock).toHaveBeenCalledWith({ region: 'eu-central-1' });
  });

  it('passes no credentials, leaving the default provider chain to resolve them', () => {
    makeService({});
    const config = SESv2ClientMock.mock.calls[0][0] as Record<string, unknown>;
    expect(config).not.toHaveProperty('credentials');
  });

  it('defaults the region to eu-central-1, never eu-west-3', () => {
    makeService({});
    expect(SESv2ClientMock).toHaveBeenCalledWith({ region: 'eu-central-1' });
  });
});

describe('NewsletterService: subscribe', () => {
  it('adds the contact to the configured list', async () => {
    const service = makeService({ AWS_SES_CONTACT_LIST_NAME: 'kambriq-newsletter' });

    await service.subscribe(subscription('alice@example.com'));

    expect(CreateContactCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ContactListName: 'kambriq-newsletter',
        EmailAddress: 'alice@example.com',
      }),
    );
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('defaults to the contact list Terraform owns', async () => {
    const service = makeService({});
    await service.subscribe(subscription('bob@example.com'));

    const input = CreateContactCommandMock.mock.calls[0][0] as Record<string, unknown>;
    expect(input['ContactListName']).toBe('kambriq-newsletter');
  });

  it('translates an already-subscribed address into a 409', async () => {
    mockSend.mockRejectedValueOnce(named('AlreadyExistsException'));
    const service = makeService({});

    await expect(service.subscribe(subscription('alice@example.com'))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  // Subscriptions that fail to store must not succeed silently.
  it('propagates AccessDenied rather than resolving quietly', async () => {
    mockSend.mockRejectedValueOnce(
      named('AccessDeniedException', 'not authorized to perform ses:CreateContact'),
    );
    const service = makeService({});

    await expect(service.subscribe(subscription('alice@example.com'))).rejects.toThrow(
      'not authorized to perform ses:CreateContact',
    );
  });

  it('propagates any other SES failure', async () => {
    mockSend.mockRejectedValueOnce(named('ThrottlingException', 'slow down'));
    const service = makeService({});

    await expect(service.subscribe(subscription('alice@example.com'))).rejects.toThrow('slow down');
  });
});

describe('NewsletterService: consent (P2)', () => {
  it('refuses a subscription without consent, and sends nothing to SES', async () => {
    const service = makeService({});

    await expect(
      service.subscribe(subscription('alice@example.com', { consent: false as unknown as true })),
    ).rejects.toBeInstanceOf(NewsletterConsentRequiredError);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("stamps the consent with the server's clock, never a caller's", async () => {
    jest.useFakeTimers({ now: new Date('2026-09-23T10:15:30.000Z') });
    try {
      const service = makeService({});
      await service.subscribe(subscription('alice@example.com'));
    } finally {
      jest.useRealTimers();
    }

    expect(storedAttributes()['consentGivenAt']).toBe('2026-09-23T10:15:30.000Z');
  });

  it('stores the policy the consent pointed at, and the language of the page', async () => {
    const service = makeService({});
    await service.subscribe(subscription('alice@example.com', { locale: 'en' }));

    expect(storedAttributes()).toEqual(
      expect.objectContaining({ consentPolicyPath: '/legal/privacy', locale: 'en' }),
    );
  });
});
