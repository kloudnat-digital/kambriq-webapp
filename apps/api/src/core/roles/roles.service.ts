import { Injectable } from '@nestjs/common';
import { CorePrismaService } from '../prisma/core-prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: CorePrismaService) {}

  async findAll() {
    return this.prisma.role.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async findByCode(code: string) {
    return this.prisma.role.findUnique({ where: { code } });
  }
}
