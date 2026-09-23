import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { LandsAgentController } from '../../../lands/controllers/lands-agent.controller';
import { LandReservationsService } from '../../../lands/reservations/reservations.service';
import type { LandsPrismaService } from '../../../lands/prisma/lands-prisma.service';
import type { UsersService } from '../../../core/users/users.service';
import {
  mockEmailService,
  mockI18n,
  mockLandsPrisma,
  mockQueue,
  mockStorageService,
} from '../../utils/mocks';

/**
 * An agent reads their own reservations, and nobody else's.
 *
 * The detail route called `findOne(id)`, which took no owner, while the list
 * route scoped on `agentUserId` and the cancel route enforced ownership. So one
 * reader out of three answered for any reservation in the database - and its
 * answer carries a presigned download URL for every identity document the
 * client uploaded.
 */
const OWNER = 'agent-owns-it';
const STRANGER = 'agent-does-not';

const reservation = (over: Record<string, unknown> = {}) => ({
  id: 'res-1',
  agentUserId: OWNER,
  status: 'PENDING',
  clientName: 'Alice',
  createdAt: new Date(),
  land: { id: 'land-1', title: 'Parcelle Kribi', label: { code: 'TFL', name: 'Titre foncier' } },
  landClientDocuments: [{ id: 'doc-1', type: 'ID_CARD', url: 'clients/alice/id.pdf' }],
  ...over,
});

const build = () => {
  const prisma = mockLandsPrisma();
  const storage = mockStorageService();
  const service = new LandReservationsService(
    prisma as unknown as LandsPrismaService,
    {} as UsersService,
    mockEmailService() as never,
    storage as never,
    mockI18n() as never,
    mockQueue() as never,
  );
  return { prisma, storage, service };
};

describe('an agent reads only the reservations they hold', () => {
  it('returns the reservation to the agent it belongs to', async () => {
    const { prisma, service } = build();
    prisma.landReservation.findUnique.mockResolvedValue(reservation());

    await expect(service.findOneForAgent(OWNER, 'res-1')).resolves.toMatchObject({ id: 'res-1' });
  });

  it('refuses another agent', async () => {
    const { prisma, service } = build();
    prisma.landReservation.findUnique.mockResolvedValue(reservation());

    await expect(service.findOneForAgent(STRANGER, 'res-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses before it presigns a link to the client documents', async () => {
    // The refusal is what matters legally; the ordering is what matters in
    // practice, because presigning is the step that produces a readable URL.
    const { prisma, storage, service } = build();
    prisma.landReservation.findUnique.mockResolvedValue(reservation());

    await expect(service.findOneForAgent(STRANGER, 'res-1')).rejects.toThrow();
    expect(storage.getDownloadUrl).not.toHaveBeenCalled();
  });

  it('still answers not-found for a reservation that does not exist', async () => {
    const { prisma, service } = build();
    prisma.landReservation.findUnique.mockResolvedValue(null);

    await expect(service.findOneForAgent(OWNER, 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('carries the caller identity across the controller boundary', async () => {
    // The service can only scope on an id the controller actually forwards, and
    // a hand-built call is where an argument goes missing.
    const service = { findOneForAgent: jest.fn() } as unknown as LandReservationsService;
    const controller = new LandsAgentController({} as never, service);

    await controller.getReservation({ id: OWNER } as never, 'res-1');

    expect(service.findOneForAgent).toHaveBeenCalledWith(OWNER, 'res-1');
  });
});
