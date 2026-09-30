import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { CandidateStatus } from '@kambriq/common/constants/kbs';
import { LandReservationStatus, StorageService } from '@kambriq/common';
import { KbsCandidatesService } from '../../kbs/candidates/candidates.service';
import { KbsPrismaService } from '../../kbs/prisma/kbs-prisma.service';
import { LandsService } from '../../lands/lands.service';
import { LandsPrismaService } from '../../lands/prisma/lands-prisma.service';
import { KamnetAgentsService } from '../../kamnet/agents/agents.service';
import { KamnetPrismaService } from '../../kamnet/prisma/kamnet-prisma.service';
import { mockI18n, mockStorageService } from '../utils';
import { openKbsTestDatabase, type KbsTestDatabase } from './kbs-test-db';
import { openTestDatabase, type TestDatabase as LandsDatabase } from './lands-test-db';
import { openKamnetTestDatabase, type KamnetTestDatabase } from './kamnet-test-db';

/**
 * C33 and I48 - a read that returns a linked record says whether it still
 * stands. Against the real migrations of each database.
 */
const config = (key: string, url: string) =>
  ({ get: (k: string) => (k === key ? url : undefined) }) as unknown as ConfigService;

const YEAR = 365 * 24 * 60 * 60 * 1000;

describe('C33 - a revoked newest certificate is read as revoked, never as current', () => {
  let db: KbsTestDatabase;
  let prisma: KbsPrismaService;
  let service: KbsCandidatesService;

  beforeAll(async () => {
    db = openKbsTestDatabase();
    prisma = new KbsPrismaService(config('DATABASE_URL_KBS', db.url));
    await prisma.onModuleInit();
    const users = { findManyByIds: jest.fn().mockResolvedValue([]) };
    service = new KbsCandidatesService(
      prisma,
      {} as never,
      mockI18n() as never,
      users as never,
      mockStorageService() as unknown as StorageService,
      {} as never,
    );
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
    await db.close();
  });

  /** A certified candidate whose older certificate stands and whose newest is revoked. */
  const revokedNewest = async () => {
    const userId = randomUUID();
    const candidate = await db.prisma.kbsCandidate.create({
      data: { userId, status: CandidateStatus.CERTIFIED },
    });
    const now = Date.now();
    const tag = randomUUID().slice(0, 8);
    await db.prisma.kbsCertificate.create({
      data: {
        candidateId: candidate.id,
        kcaNumber: `KCA-C33-OLD-${tag}`,
        issueDate: new Date(now - YEAR),
        validUntil: new Date(now + YEAR),
      },
    });
    await db.prisma.kbsCertificate.create({
      data: {
        candidateId: candidate.id,
        kcaNumber: `KCA-C33-NEW-${tag}`,
        issueDate: new Date(now - 1_000),
        validUntil: new Date(now + 2 * YEAR),
        revokedAt: new Date(now - 500),
      },
    });
    return { userId, newest: `KCA-C33-NEW-${tag}` };
  };

  it("the candidate's own profile says the newest certificate is revoked", async () => {
    const { userId, newest } = await revokedNewest();
    const profile = await service.getMyProfile(userId);
    expect(profile.certificate).toMatchObject({ kcaNumber: newest, state: 'REVOKED' });
  });

  it("the administrators' candidate list says the certificate is revoked", async () => {
    const { userId, newest } = await revokedNewest();
    const page = await service.findAll({ page: 1, limit: 5 } as never, undefined, userId);
    expect(page.data).toEqual([
      expect.objectContaining({ kcaNumber: newest, certificateState: 'REVOKED' }),
    ]);
  });
});

describe('I48 - the land list counts live reservations only', () => {
  let db: LandsDatabase;
  let prisma: LandsPrismaService;
  let service: LandsService;

  beforeAll(async () => {
    db = openTestDatabase();
    prisma = new LandsPrismaService(config('DATABASE_URL_LANDS', db.url));
    await prisma.onModuleInit();
    service = new LandsService(
      prisma,
      mockStorageService() as unknown as StorageService,
      mockI18n() as never,
    );
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
    await db.close();
  });

  it('a parcel with one cancelled and one pending reservation counts one', async () => {
    const tag = randomUUID();
    const label = await db.prisma.landLabel.upsert({
      where: { code: 'TFL' },
      create: { code: 'TFL', name: 'Titre foncier' },
      update: {},
    });
    const land = await db.prisma.land.create({
      data: {
        title: `I48 ${tag}`,
        slug: `i48-${tag}`,
        description: 'Created by the database-backed suite.',
        region: 'Ouest',
        sizeM2: 500,
        totalPrice: 15_000_000,
        labelId: label.id,
      },
    });
    for (const status of [LandReservationStatus.CANCELLED, LandReservationStatus.PENDING]) {
      await db.prisma.landReservation.create({
        data: {
          landId: land.id,
          status,
          agentUserId: `agent-${tag}`,
          clientUserId: `client-${tag}`,
          clientName: 'I48 Client',
          clientEmail: `i48-${randomUUID()}@example.test`,
          downPaymentAmount: 750_000n,
        },
      });
    }

    const page = await service.findAll(
      { page: 1, limit: 5 } as never,
      { search: `I48 ${tag}` } as never,
    );
    const row = page.data.find((l) => l.id === land.id);
    expect(row?._count.reservations).toBe(1);
  });
});

describe('I48 - an agent read says whether the sponsor is suspended', () => {
  let db: KamnetTestDatabase;
  let prisma: KamnetPrismaService;
  let service: KamnetAgentsService;

  beforeAll(async () => {
    db = openKamnetTestDatabase();
    prisma = new KamnetPrismaService(config('DATABASE_URL_KAMNET', db.url));
    await prisma.onModuleInit();
    const users = {
      findById: jest.fn().mockResolvedValue({ firstName: 'I48', lastName: 'Agent' }),
    };
    service = new KamnetAgentsService(
      prisma,
      users as never,
      {} as never,
      mockI18n() as never,
      {} as never,
      {} as never,
    );
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
    await db.close();
  });

  it('returns the sponsor with suspended: true when the sponsor is suspended', async () => {
    const sponsorId = randomUUID();
    const agentId = randomUUID();
    await db.prisma.kamnetAgent.create({
      data: {
        id: sponsorId,
        userId: randomUUID(),
        kcaNumber: `KCA-I48-S-${sponsorId.slice(0, 8)}`,
        agentCode: `AGT-I48-S-${sponsorId.slice(0, 8)}`,
        suspendedAt: new Date(),
      },
    });
    await db.prisma.kamnetAgent.create({
      data: {
        id: agentId,
        userId: randomUUID(),
        kcaNumber: `KCA-I48-A-${agentId.slice(0, 8)}`,
        agentCode: `AGT-I48-A-${agentId.slice(0, 8)}`,
        sponsorId,
      },
    });

    const agent = await service.findById(agentId);
    expect(agent.sponsor).toMatchObject({ id: sponsorId, suspended: true });
  });
});
