import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { EmailService } from '../../email/email.service';
import { QUEUES, NOTIFICATIONS_JOBS } from '../../constants/queue';
import { mockQueue } from '../utils/mocks';

describe('EmailService', () => {
  let service: EmailService;
  let queue: ReturnType<typeof mockQueue>;

  beforeEach(async () => {
    queue = mockQueue();

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService, { provide: getQueueToken(QUEUES.NOTIFICATIONS), useValue: queue }],
    }).compile();

    service = module.get(EmailService);
  });

  describe('send', () => {
    it('enqueues a single email job with retry config', async () => {
      await service.send({
        to: 'test@kambriq.com',
        template: 'verification',
        lang: 'fr',
        args: { firstName: 'Alice', verificationUrl: 'https://...' },
      });

      expect(queue.add).toHaveBeenCalledWith(
        NOTIFICATIONS_JOBS.SEND_EMAIL,
        expect.objectContaining({
          to: 'test@kambriq.com',
          template: 'verification',
          lang: 'fr',
        }),
        expect.objectContaining({
          attempts: 3,
          backoff: expect.objectContaining({ type: 'exponential' }),
        }),
      );
    });
  });

  describe('sendBatch', () => {
    it('enqueues multiple email jobs in bulk', async () => {
      const payloads = [
        {
          to: 'a@test.com',
          template: 'verification' as const,
          lang: 'en',
          args: {},
        },
        {
          to: 'b@test.com',
          template: 'verification' as const,
          lang: 'fr',
          args: {},
        },
      ];

      await service.sendBatch(payloads);

      expect(queue.addBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({ to: 'a@test.com' }),
          }),
          expect.objectContaining({
            data: expect.objectContaining({ to: 'b@test.com' }),
          }),
        ]),
      );
    });
  });
});

/**
 * The guard that catches the missing `await` for every template at once.
 *
 * A dead link in an auth email is invisible from every side except the
 * recipient's: the queue accepts the job, the worker renders the template, SES
 * delivers, and the metrics say success. Throwing here is the loud failure.
 */
describe('EmailService: unresolved interpolation arguments', () => {
  let service: EmailService;
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService, { provide: getQueueToken(QUEUES.NOTIFICATIONS), useValue: queue }],
    }).compile();
    service = module.get(EmailService);
  });

  it.each([
    ['[object Promise]', 'a missing await'],
    ['[object Object]', 'an object where a string was expected'],
  ])('refuses to queue an email whose argument is %s (%s)', async (bad) => {
    await expect(
      service.send({
        to: 'user@kambriq.com',
        template: 'verification',
        lang: 'fr',
        args: { firstName: 'Alice', verificationUrl: `https://dev.kambriq.com/v?token=${bad}` },
      }),
    ).rejects.toThrow(/verificationUrl/);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('queues an email whose arguments are all resolved', async () => {
    await expect(
      service.send({
        to: 'user@kambriq.com',
        template: 'verification',
        lang: 'fr',
        args: { firstName: 'Alice', verificationUrl: 'https://dev.kambriq.com/v?token=abc123' },
      }),
    ).resolves.toBeUndefined();

    expect(queue.add).toHaveBeenCalledTimes(1);
  });
});

/**
 * A `…Name` field must not carry an identifier.
 *
 * `clientPortalAccess` was sent with `agentName: agentUserId`, so clients read
 * "Votre agent KAMNET : 00000000-0000-4000-8000-b00000000005". The check sits
 * beside the `[object …]` one, at the single place every template argument
 * passes through, so it covers templates nobody has written yet.
 */
describe('EmailService: identifiers where a name belongs', () => {
  let service: EmailService;
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService, { provide: getQueueToken(QUEUES.NOTIFICATIONS), useValue: queue }],
    }).compile();
    service = module.get(EmailService);
  });

  const payload = (agentName: string) => ({
    to: 'client@kambriq.com',
    template: 'clientPortalAccess' as const,
    lang: 'fr',
    args: { clientName: 'Alice', landTitle: 'Parcelle Kribi', price: '8000000', agentName },
  });

  it('refuses to queue an email whose name field is a uuid', async () => {
    await expect(service.send(payload('00000000-0000-4000-8000-b00000000005'))).rejects.toThrow(
      /agentName.*identifier, not a name/,
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('queues an email whose name field is a name', async () => {
    await expect(service.send(payload('Eric Mbou'))).resolves.toBeUndefined();
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('queues an email whose name field is empty, because the template omits the line', async () => {
    await expect(service.send(payload(''))).resolves.toBeUndefined();
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('does not object to a uuid in a field that is not a name', async () => {
    await expect(
      service.send({
        to: 'client@kambriq.com',
        template: 'clientPortalAccess',
        lang: 'fr',
        args: { clientName: 'Alice', reservationId: '00000000-0000-4000-8000-b00000000005' },
      }),
    ).resolves.toBeUndefined();
    expect(queue.add).toHaveBeenCalledTimes(1);
  });
});
