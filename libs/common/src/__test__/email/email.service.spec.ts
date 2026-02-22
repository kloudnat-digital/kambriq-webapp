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
      providers: [
        EmailService,
        { provide: getQueueToken(QUEUES.NOTIFICATIONS), useValue: queue },
      ],
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
