import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { EmailService } from '@kambriq/common';
import { KamnetApplicationsService } from '../../../kamnet/applications/applications.service';
import { KamnetPrismaService } from '../../../kamnet/prisma/kamnet-prisma.service';
import { UsersService } from '../../../core/users/users.service';
import { KbsCandidatesService } from '../../../kbs/candidates/candidates.service';
import { buildUserResponse, mockI18n } from '../../utils';

/**
 * P5 - an application is stored first, then announced to KAMBRIQ.
 *
 * `submit` stored the application and emailed the applicant, and told nobody at
 * KAMBRIQ: no screen lists applications, so one could sit unseen. It is now
 * announced to `CONTACT_INBOX_EMAIL`, the address the contact form already uses,
 * with the same rule as L1: the record is the success, and a failed
 * announcement is logged loudly without failing the request - the applicant is
 * already stored, and telling them nothing arrived would make them apply twice.
 */
const KCA = 'KCA-20250101-0001';

describe('P5 - a KAMNET application is announced to the contact inbox', () => {
  let service: KamnetApplicationsService;
  let send: jest.Mock;
  let create: jest.Mock;
  let inbox: string | undefined;

  const build = async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KamnetApplicationsService,
        {
          provide: KamnetPrismaService,
          useValue: {
            kamnetApplication: { findUnique: jest.fn().mockResolvedValue(null), create },
            kamnetAgent: { findUnique: jest.fn().mockResolvedValue(null) },
          },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn().mockResolvedValue(
              buildUserResponse({
                email: 'ada@example.test',
                firstName: 'Ada',
                lastName: 'Ngono',
                phone: '+237600000000',
                language: 'fr',
              }),
            ),
          },
        },
        {
          provide: KbsCandidatesService,
          useValue: {
            findActiveCertificate: jest.fn().mockResolvedValue({ kcaNumber: KCA }),
          },
        },
        { provide: EmailService, useValue: { send } },
        { provide: I18nService, useValue: mockI18n() },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: unknown) =>
              key === 'CONTACT_INBOX_EMAIL' ? inbox : fallback,
          },
        },
      ],
    }).compile();
    service = module.get(KamnetApplicationsService);
  };

  beforeEach(async () => {
    inbox = 'contact@kambriq.test';
    send = jest.fn().mockResolvedValue(undefined);
    create = jest.fn(({ data }) =>
      Promise.resolve({ id: 'app-1', createdAt: new Date(), ...data }),
    );
    await build();
  });

  it('announces the application to the contact inbox, with who applied and their certificate', async () => {
    await service.submit('u1', { kcaNumber: KCA, motivation: 'Je veux accompagner mes clients.' });

    const toInbox = send.mock.calls.map(([m]) => m).find((m) => m.to === 'contact@kambriq.test');
    expect(toInbox).toMatchObject({
      template: 'kamnetApplicationNotification',
      args: expect.objectContaining({
        name: 'Ada Ngono',
        email: 'ada@example.test',
        kcaNumber: KCA,
        motivation: 'Je veux accompagner mes clients.',
      }),
    });
  });

  it('still stores the application, and says so loudly, when the announcement fails', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    send.mockImplementation(async (m: { to: string }) => {
      if (m.to === 'contact@kambriq.test') throw new Error('SES down');
    });
    try {
      await expect(service.submit('u1', { kcaNumber: KCA })).resolves.toMatchObject({
        id: 'app-1',
      });
      expect(create).toHaveBeenCalled();
      expect(error).toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it("does not fail the request when the applicant's own confirmation fails", async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    send.mockImplementation(async (m: { to: string }) => {
      if (m.to === 'ada@example.test') throw new Error('SES down');
    });
    try {
      await expect(service.submit('u1', { kcaNumber: KCA })).resolves.toMatchObject({
        id: 'app-1',
      });
      expect(send.mock.calls.some(([m]) => m.to === 'contact@kambriq.test')).toBe(true);
    } finally {
      error.mockRestore();
    }
  });

  it('logs an error, and still stores, when no inbox is configured', async () => {
    inbox = undefined;
    await build();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      await service.submit('u1', { kcaNumber: KCA });
      expect(create).toHaveBeenCalled();
      expect(error).toHaveBeenCalledWith(expect.stringContaining('CONTACT_INBOX_EMAIL'));
    } finally {
      error.mockRestore();
    }
  });
});
