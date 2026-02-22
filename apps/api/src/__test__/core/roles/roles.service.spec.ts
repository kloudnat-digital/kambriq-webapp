import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from '../../../core/roles/roles.service';
import { buildRole, mockCorePrisma, resetIdCounter } from '../../utils';
import { CorePrismaService } from '../../../core/prisma/core-prisma.service';

describe('RolesService', () => {
  let service: RolesService;
  let prisma: ReturnType<typeof mockCorePrisma>;

  beforeEach(async () => {
    jest.clearAllMocks();
    resetIdCounter();
    prisma = mockCorePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: CorePrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(RolesService);
  });

  describe('findAll', () => {
    it('returns all roles ordered by code', async () => {
      const roles = [buildRole('ADMIN_GLOBAL'), buildRole('CLIENT')];
      prisma.role.findMany.mockResolvedValue(roles);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(prisma.role.findMany).toHaveBeenCalledWith({
        orderBy: { code: 'asc' },
      });
    });
  });

  describe('findByCode', () => {
    it('returns the role matching the code', async () => {
      const role = buildRole('CLIENT');
      prisma.role.findUnique.mockResolvedValue(role);

      const result = await service.findByCode('CLIENT');

      expect(result.code).toBe('CLIENT');
      expect(prisma.role.findUnique).toHaveBeenCalledWith({
        where: { code: 'CLIENT' },
      });
    });

    it('returns null for unknown code', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      const result = await service.findByCode('FAKE');
      expect(result).toBeNull();
    });
  });
});
