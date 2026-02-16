import { Injectable } from '@nestjs/common';
import { PrismaService } from '@kambriq/db';
import { GlobalRole } from '@kambriq/shared';

export type CreateUserPayload = {
  email: string;
  password: string;
  roleName?: GlobalRole;
};

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async createUser(payload: CreateUserPayload) {
    const roleName = payload.roleName || GlobalRole.CLIENT;

    return this.prisma.user.create({
      data: {
        email: payload.email,
        password: payload.password,
        roles: {
          create: {
            role: {
              connectOrCreate: {
                where: { name: roleName },
                create: { name: roleName },
              },
            },
          },
        },
      },
      select: {
        id: true,
        email: true,
        status: true,
        roles: { select: { role: { select: { name: true } } } },
        createdAt: true,
      },
    });
  }

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        status: true,
      },
    });
  }

  async findUserWithRolesById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        status: true,
        roles: { select: { role: { select: { name: true } } } },
      },
    });
  }
}
