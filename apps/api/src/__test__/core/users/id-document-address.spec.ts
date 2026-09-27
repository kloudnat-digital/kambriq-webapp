import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EmailService, StorageService } from '@kambriq/common';
import { I18nService } from 'nestjs-i18n';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../../core/users/users.service';
import { CorePrismaService } from '../../../core/prisma/core-prisma.service';
import {
  mockConfigService,
  mockCorePrisma,
  mockEmailService,
  mockI18n,
  mockStorageService,
} from '../../utils';
import { buildUserWithRoles } from '../../utils/factories';

/**
 * A49 - an identity document is a key in its owner's own storage folder.
 *
 * `PATCH /users/me/id-document` took `z.string().min(1)` - any string - and
 * stored it, and `StorageService.getDownloadUrl` hands an `http(s)` value back
 * as it stands. A customer's identity document could therefore be "stored" as
 * an address on somebody else's server, and travel from there to the review
 * queue. Same class as A44, same mechanism: `core/users/storage-keys.ts`.
 *
 * Measured on dev before this: 241 documents, all keys in their owner's folder,
 * all written by the delivery journeys - none stored as an address.
 */
describe('A49 - the identity documents a person may store', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof mockCorePrisma>;
  const user = buildUserWithRoles(['CLIENT']);
  const own = `users/${user.id}/id-documents/1790357245776-journey.txt`;

  beforeEach(async () => {
    prisma = mockCorePrisma();
    prisma.user.findUnique.mockResolvedValue({ ...user, profile: null });
    prisma.userProfile.upsert.mockResolvedValue({});
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: CorePrismaService, useValue: prisma },
        { provide: EmailService, useValue: mockEmailService() },
        { provide: I18nService, useValue: mockI18n() },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: StorageService, useValue: mockStorageService() },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  it('stores keys the upload route issued to this person', async () => {
    await service.submitIdDocument(user.id, { idDocumentUrls: [own] });
    expect(prisma.userProfile.upsert).toHaveBeenCalled();
  });

  it.each([
    ['a foreign site', 'https://evil.example/cni.png'],
    ['our own bucket, as a URL', `https://kambriq-media-dev.s3.eu-central-1.amazonaws.com/${own}`],
    [
      "another person's document",
      'users/00000000-0000-4000-8000-b00000000009/id-documents/1-cni.png',
    ],
    ["this person's avatar", `users/${user.id}/avatar/1-photo.png`],
    ['a key that climbs out of its folder', `users/${user.id}/id-documents/../avatar/1-p.png`],
  ])('refuses %s, and stores nothing', async (_what, value) => {
    await expect(
      service.submitIdDocument(user.id, { idDocumentUrls: [own, value] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.userProfile.upsert).not.toHaveBeenCalled();
  });
});
