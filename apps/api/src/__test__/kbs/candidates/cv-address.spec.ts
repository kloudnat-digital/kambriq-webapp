import { BadRequestException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Test, type TestingModule } from '@nestjs/testing';
import { EmailService, StorageService } from '@kambriq/common';
import { CorePrismaService } from '../../../core/prisma/core-prisma.service';
import { UsersService } from '../../../core/users/users.service';
import { KbsCandidatesService } from '../../../kbs/candidates/candidates.service';
import { KbsPrismaService } from '../../../kbs/prisma/kbs-prisma.service';
import {
  buildCandidate,
  mockCorePrisma,
  mockEmailService,
  mockI18n,
  mockKbsPrisma,
  mockStorageService,
} from '../../utils';

/**
 * A52 - a KBS candidate's CV is a key in their own CV folder, nothing else.
 *
 * `enroll` took `cvUrl: z.string().min(1)` - any string - and stored it, and
 * `StorageService.getDownloadUrl` hands an address back as it stands. Same class
 * as A44 and A49, same rule (`core/users/storage-keys.ts`), one folder further:
 * the CV upload route issues `kbs/candidates/<id>/cv/<timestamp>-<name>`.
 *
 * Counted on dev before this: 136 candidates, none with a CV stored.
 */
describe('A52 - the CV a candidate may store', () => {
  let service: KbsCandidatesService;
  let prisma: ReturnType<typeof mockKbsPrisma>;
  const own = 'kbs/candidates/u1/cv/1790375055770-cv.pdf';

  beforeEach(async () => {
    prisma = mockKbsPrisma();
    const corePrisma = mockCorePrisma();
    prisma.kbsCandidate.findUnique.mockResolvedValue(null);
    prisma.kbsCandidate.create.mockResolvedValue(buildCandidate({ userId: 'u1' }));
    corePrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'user@test.com',
      firstName: 'Alice',
      preferredLanguage: 'fr',
      profile: { idDocumentUrls: ['users/u1/id-documents/1-cni.png'] },
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KbsCandidatesService,
        { provide: KbsPrismaService, useValue: prisma },
        { provide: CorePrismaService, useValue: corePrisma },
        { provide: I18nService, useValue: mockI18n() },
        { provide: UsersService, useValue: { addRole: jest.fn() } },
        { provide: StorageService, useValue: mockStorageService() },
        { provide: EmailService, useValue: mockEmailService() },
      ],
    }).compile();
    service = module.get(KbsCandidatesService);
  });

  const enroll = (cvUrl?: string) => service.enroll('u1', { cvUrl, engagementAccepted: true });

  it('stores a key the CV upload route issued to this person', async () => {
    await enroll(own);
    expect(prisma.kbsCandidate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cvUrl: own }) }),
    );
  });

  it('still enrols somebody who sends no CV', async () => {
    await enroll(undefined);
    expect(prisma.kbsCandidate.create).toHaveBeenCalled();
  });

  it.each([
    ['a foreign site', 'https://evil.example/cv.pdf'],
    ['our own bucket, as a URL', `https://kambriq-media-dev.s3.eu-central-1.amazonaws.com/${own}`],
    ["another person's CV", 'kbs/candidates/u2/cv/1-cv.pdf'],
    ["this person's identity document", 'users/u1/id-documents/1-cni.png'],
    ['a key that climbs out of its folder', 'kbs/candidates/u1/cv/../../u2/cv/1-cv.pdf'],
  ])('refuses %s, and enrols nobody', async (_what, value) => {
    await expect(enroll(value)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.kbsCandidate.create).not.toHaveBeenCalled();
  });
});
