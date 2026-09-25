import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EmailService, StorageService } from '@kambriq/common';
import { I18nService } from 'nestjs-i18n';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../../core/users/users.service';
import { CorePrismaService } from '../../../core/prisma/core-prisma.service';
import { updateAgentProfileDto } from '../../../kamnet/dto/kamnet.dto';
import {
  mockConfigService,
  mockCorePrisma,
  mockEmailService,
  mockI18n,
  mockStorageService,
} from '../../utils';
import { buildUserWithRoles } from '../../utils/factories';

/**
 * A44 - an avatar is a key in the caller's own storage, and nothing else.
 *
 * `PATCH /users/me` took `avatarUrl: z.string()`, the KAMNET profile took any
 * URL, and `StorageService.getDownloadUrl` hands an `http(s)` value back as it
 * stands. So an agent could point their photo at any site, and the address
 * travelled wherever the value goes - the public directory's API among them. The
 * CSP only stops one surface from DISPLAYING it; the value is refused here,
 * where it enters.
 *
 * The upload route issues `users/<id>/avatar/<timestamp>-<name>`, and the web
 * sends that key back. No URL is legitimate, including one on our own bucket:
 * a key is what storage resolves, and a second accepted form is a second way in.
 */
describe('A44 - the avatar a person may store', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof mockCorePrisma>;
  const user = buildUserWithRoles(['AGENT']);
  const own = `users/${user.id}/avatar/1790350104135-avatar.png`;

  beforeEach(async () => {
    prisma = mockCorePrisma();
    prisma.user.findUnique.mockResolvedValue(user);
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

  const stored = () =>
    (prisma.userProfile.upsert.mock.calls[0]?.[0] as { update?: { avatarUrl?: string } })?.update
      ?.avatarUrl;

  it('stores a key the upload route issued to this person', async () => {
    await service.updateMe(user.id, { avatarUrl: own });
    expect(stored()).toBe(own);
  });

  it.each([
    ['a foreign site', 'https://evil.example/tracker.png'],
    ['our own bucket, as a URL', `https://kambriq-media-dev.s3.eu-central-1.amazonaws.com/${own}`],
    ["another person's key", 'users/00000000-0000-4000-8000-b00000000009/avatar/1-a.png'],
    ["this person's identity document", `users/${user.id}/id-documents/1-cni.png`],
    ['a key that climbs out of its folder', `users/${user.id}/avatar/../id-documents/1-cni.png`],
  ])('refuses %s, and stores nothing', async (_what, value) => {
    await expect(service.updateMe(user.id, { avatarUrl: value })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.userProfile.upsert).not.toHaveBeenCalled();
  });

  it('still lets a person remove their photo', async () => {
    await service.updateMe(user.id, { avatarUrl: '' });
    expect(stored()).toBe('');
  });

  it('the KAMNET profile accepts the key it used to refuse as "not a URL"', () => {
    // The agent path ends in `updateMe` too, so the refusals above hold for it.
    expect(updateAgentProfileDto.safeParse({ avatarUrl: own }).success).toBe(true);
  });
});
