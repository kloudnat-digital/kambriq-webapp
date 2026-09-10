import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ContactSubject, EmailService } from '@kambriq/common';
import { ContactService, DigestUndeliverableError } from '../../../core/contact/contact.service';
import { CorePrismaService } from '../../../core/prisma/core-prisma.service';
import { mockCorePrisma, mockEmailService } from '../../utils';

const INBOX = 'backoffice@contact.test';

const ROW = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  name: 'Amina Nkolo',
  email: 'prospect@example.test',
  subject: ContactSubject.LANDS,
  message: 'Je cherche une parcelle titree.',
  locale: 'fr',
};

const input = (over: Record<string, unknown> = {}) => ({
  name: ROW.name,
  email: ROW.email,
  phone: '+33 6 12 34 56 78',
  subject: ContactSubject.LANDS,
  message: ROW.message,
  locale: 'fr' as const,
  consent: true as const,
  consentPolicyPath: '/legal/privacy',
  ...over,
});

describe('L1 - ContactService', () => {
  let service: ContactService;
  let prisma: ReturnType<typeof mockCorePrisma>;
  let email: ReturnType<typeof mockEmailService>;
  let config: { get: jest.Mock };

  const build = async (settings: Record<string, string | undefined> = {}) => {
    prisma = mockCorePrisma();
    email = mockEmailService();
    prisma.contactRequest.create.mockResolvedValue(ROW);

    config = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string | undefined> = {
          CONTACT_INBOX_EMAIL: INBOX,
          CONTACT_BACKOFFICE_LOCALE: 'fr',
          ...settings,
        };
        return key in values ? values[key] : fallback;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        { provide: CorePrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(ContactService);
  };

  /** Every `send` call, as the payloads they were. */
  const sends = () =>
    (email.send as jest.Mock).mock.calls.map(
      ([payload]) =>
        payload as { to: string; template: string; lang: string; args: Record<string, unknown> },
    );

  beforeEach(async () => {
    jest.clearAllMocks();
    await build();
  });

  // ----- THE ACKNOWLEDGEMENT, IN THE PAGE'S LANGUAGE ----- //

  describe('the acknowledgement goes out in the language of the page', () => {
    it.each([
      ['fr', 'French'],
      ['en', 'English'],
    ])('locale %s (%s) is the language of the prospect acknowledgement', async (locale) => {
      await service.submit(input({ locale }));

      const ack = sends().find((s) => s.template === 'contactRequestReceived');
      expect(ack).toBeDefined();
      expect(ack?.lang).toBe(locale);
      expect(ack?.to).toBe(ROW.email);

      // And it is stored on the row, so a human reply months later is written
      // in the same language without anybody having to work it out.
      const stored = prisma.contactRequest.create.mock.calls[0][0] as {
        data: { locale: string };
      };
      expect(stored.data.locale).toBe(locale);
    });

    it('the back office is written to in its own language, not the prospect’s', async () => {
      // A prospect writing in English must not switch the team's notification
      // into English: the two messages have two different readers.
      await service.submit(input({ locale: 'en' }));

      const notification = sends().find((s) => s.template === 'contactRequestNotification');
      expect(notification?.lang).toBe('fr');
      expect(notification?.to).toBe(INBOX);

      const ack = sends().find((s) => s.template === 'contactRequestReceived');
      expect(ack?.lang).toBe('en');
    });

    it('sends exactly two messages: the team and the prospect', async () => {
      await service.submit(input());

      expect(
        sends()
          .map((s) => s.template)
          .sort(),
      ).toEqual(['contactRequestNotification', 'contactRequestReceived']);
    });
  });

  // ----- THE WRITE IS THE SUCCESS CRITERION ----- //

  describe('what decides success', () => {
    it('persists the request with the server’s consent timestamp', async () => {
      const before = Date.now();
      await service.submit(input());

      const { data } = prisma.contactRequest.create.mock.calls[0][0] as {
        data: { consentGivenAt: Date; consentPolicyPath: string; name: string };
      };
      expect(data.consentGivenAt).toBeInstanceOf(Date);
      expect(data.consentGivenAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(data.consentPolicyPath).toBe('/legal/privacy');
    });

    it('a failed write fails the request, and nothing is sent', async () => {
      // The prospect must not be told "sent" when nothing was stored. That is
      // the exact defect this chantier exists to remove, in reverse.
      prisma.contactRequest.create.mockRejectedValue(new Error('connection refused'));

      await expect(service.submit(input())).rejects.toThrow('connection refused');
      expect(email.send).not.toHaveBeenCalled();
    });

    it('an email that cannot be queued does NOT fail the request', async () => {
      /**
       * Deliberate, and it is a trade rather than an oversight. The lead is
       * already stored; returning an error here would tell somebody who wrote
       * three paragraphs that nothing arrived, and they would send it again.
       *
       * It is only defensible because the daily digest counts **rows**, so a
       * request whose notification was lost is still in tomorrow's count.
       */
      (email.send as jest.Mock).mockRejectedValue(new Error('redis unreachable'));

      await expect(service.submit(input())).resolves.toMatchObject({ id: ROW.id });
    });

    it('returns a reference the prospect can quote', async () => {
      const { reference } = await service.submit(input());
      expect(reference).toMatch(/^KBQ-C-[0-9A-F]{8}$/);

      // The same one is in the acknowledgement, so what they were shown and
      // what they were sent agree.
      const ack = sends().find((s) => s.template === 'contactRequestReceived');
      expect(ack?.args['reference']).toBe(reference);
    });
  });

  // ----- CONSENT ----- //

  describe('consent', () => {
    it('refuses a request without it, before writing anything', async () => {
      await expect(service.submit(input({ consent: false }))).rejects.toThrow(/without consent/);
      expect(prisma.contactRequest.create).not.toHaveBeenCalled();
      expect(email.send).not.toHaveBeenCalled();
    });

    it('does not take a consent timestamp from the caller', async () => {
      // A consent time supplied by a client is a claim about the past. The
      // service ignores it: `consentGivenAt` is not in its input type at all,
      // and the row carries the server's clock.
      const forged = new Date('2020-01-01T00:00:00Z');
      await service.submit(input({ consentGivenAt: forged }));

      const { data } = prisma.contactRequest.create.mock.calls[0][0] as {
        data: { consentGivenAt: Date };
      };
      expect(data.consentGivenAt.getTime()).not.toBe(forged.getTime());
    });
  });

  // ----- THE INBOX ADDRESS ----- //

  describe('when CONTACT_INBOX_EMAIL is not set', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await build({ CONTACT_INBOX_EMAIL: undefined });
    });

    it('still stores the request, and still acknowledges the prospect', async () => {
      await expect(service.submit(input())).resolves.toMatchObject({ id: ROW.id });
      expect(prisma.contactRequest.create).toHaveBeenCalledTimes(1);
      expect(sends().map((s) => s.template)).toEqual(['contactRequestReceived']);
    });

    it('says so at error level and names the variable, rather than skipping quietly', async () => {
      // A degraded path must be an explicit setting, never an inference from
      // absent configuration - the rule the SES client broke for seven months.
      const logged: string[] = [];
      jest
        .spyOn(service['logger'], 'error')
        .mockImplementation((message: unknown) => void logged.push(String(message)));

      await service.submit(input());

      expect(logged.join('\n')).toMatch(/CONTACT_INBOX_EMAIL is not set/);
    });

    it('there is no fallback to EMAIL_FROM - a guessed address is a lead nobody reads', async () => {
      await service.submit(input());
      expect(sends().every((s) => s.to === ROW.email)).toBe(true);
    });
  });

  // ----- THE DAILY DIGEST ----- //

  describe('the daily digest', () => {
    beforeEach(() => {
      prisma.contactRequest.findMany.mockResolvedValue([]);
      prisma.contactRequest.count.mockResolvedValue(0);
      prisma.contactRequest.findFirst.mockResolvedValue(null);
    });

    it('is sent when the count is zero', async () => {
      const result = await service.sendDailyDigest();

      expect(result.count).toBe(0);
      expect(sends()).toHaveLength(1);
      expect(sends()[0]).toMatchObject({ to: INBOX, template: 'contactDigest' });
      expect(sends()[0].args['count']).toBe(0);
    });

    it('counts a 48-hour window, ending now', async () => {
      const now = new Date('2026-09-10T07:00:00.000Z');
      await service.sendDailyDigest(now);

      const where = (
        prisma.contactRequest.findMany.mock.calls[0][0] as {
          where: { createdAt: { gte: Date; lte: Date } };
        }
      ).where;
      expect(where.createdAt.lte).toEqual(now);
      expect(now.getTime() - where.createdAt.gte.getTime()).toBe(48 * 3_600_000);
    });

    it('breaks the window down by subject', async () => {
      prisma.contactRequest.findMany.mockResolvedValue([
        { subject: 'LANDS' },
        { subject: 'LANDS' },
        { subject: 'KBS' },
      ]);

      await service.sendDailyDigest();

      expect(sends()[0].args['count']).toBe(3);
      expect(String(sends()[0].args['breakdown'])).toContain('LANDS: 2');
      expect(String(sends()[0].args['breakdown'])).toContain('KBS: 1');
    });

    it('throws when it has nowhere to send, so the job lands on the failed set', async () => {
      /**
       * The opposite choice from the per-request notification, and the
       * difference is the point: a request that cannot be announced is still
       * stored and still surfaces tomorrow. A digest that cannot be sent has no
       * later mechanism to catch it, so resolving would be the silence this
       * whole mechanism exists to abolish.
       */
      jest.clearAllMocks();
      await build({ CONTACT_INBOX_EMAIL: undefined });
      prisma.contactRequest.findMany.mockResolvedValue([]);
      prisma.contactRequest.count.mockResolvedValue(0);
      prisma.contactRequest.findFirst.mockResolvedValue(null);

      await expect(service.sendDailyDigest()).rejects.toThrow(DigestUndeliverableError);
      expect(email.send).not.toHaveBeenCalled();
    });
  });
});
