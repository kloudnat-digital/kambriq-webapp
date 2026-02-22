import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CorePrismaService } from '../prisma/core-prisma.service';
import {
  AdminUpdateUserDto,
  UpdateProfileDto,
  UserResponse,
} from './dto/users.dto';
import {
  buildPaginatedResponse,
  EmailService,
  GRACE_PERIOD_DAYS,
  PaginationQuery,
} from '@kambriq/common';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class UsersService {
  private logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: CorePrismaService,
    private readonly emailService: EmailService,
    private readonly i18n: I18nService,
  ) {}

  // ----- Get Me ------------------------------------------
  async getMe(userId: string): Promise<UserResponse> {
    return this.toUserResponse(await this.findByIdOrThrow(userId));
  }

  // ----- Update Me ---------------------------------------
  async updateMe(userId: string, dto: UpdateProfileDto): Promise<UserResponse> {
    const userFields: Record<string, unknown> = {};
    const profileFields: Record<string, unknown> = {};

    if (dto.firstName !== undefined) userFields.firstName = dto.firstName;
    if (dto.lastName !== undefined) userFields.lastName = dto.lastName;
    if (dto.phone !== undefined) userFields.phone = dto.phone;
    if (dto.language !== undefined) userFields.preferredLanguage = dto.language;

    if (dto.avatarUrl !== undefined) profileFields.avatarUrl = dto.avatarUrl;
    if (dto.address !== undefined) profileFields.address = dto.address;
    if (dto.city !== undefined) profileFields.city = dto.city;
    if (dto.country !== undefined) profileFields.country = dto.country;

    if (Object.keys(userFields).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: userFields,
      });
    }
    if (Object.keys(profileFields).length > 0) {
      await this.prisma.userProfile.upsert({
        where: { userId },
        create: { userId, ...profileFields },
        update: profileFields,
      });
    }

    return this.getMe(userId);
  }

  // ----- Delete own account (soft delete) ----------------
  async deleteMe(userId: string): Promise<{ message: string }> {
    const user = await this.findByIdOrThrow(userId);
    const lang = user.preferredLanguage || 'en';

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false, deletedAt: new Date(), deactivatedBy: null },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.emailService.send({
      to: user.email,
      template: 'accountDeletion',
      lang,
      args: {
        firstName: user.firstName,
        days: GRACE_PERIOD_DAYS,
      },
    });

    this.logger.log('User deleted their account', { userId });
    return {
      message: this.t('user.deleteSuccess', lang, { days: GRACE_PERIOD_DAYS }),
    };
  }

  // ----- Admin: List Users ------------------------------
  async findAll(query: PaginationQuery) {
    const { page, limit, sort, order } = query;
    const skip = (page - 1) * limit;

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { [sort]: order },
        include: {
          userRoles: {
            include: { role: { select: { code: true, name: true } } },
          },
          profile: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    const data = users.map((user) => this.toUserResponse(user));
    return buildPaginatedResponse(data, total, page, limit);
  }

  // ----- Admin: Get User by ID ---------------------------
  async findById(userId: string): Promise<UserResponse> {
    return this.toUserResponse(await this.findByIdOrThrow(userId));
  }

  // ----- Admin: Update user (active status, roles) -------
  async adminUpdate(
    userId: string,
    dto: AdminUpdateUserDto,
    adminId: string,
  ): Promise<UserResponse> {
    if (dto.roleCodes) {
      const roles = await this.prisma.role.findMany({
        where: { code: { in: dto.roleCodes } },
      });

      if (roles.length !== dto.roleCodes.length) {
        const foundCodes = roles.map((r) => r.code);
        const missingCodes = dto.roleCodes.filter(
          (code) => !foundCodes.includes(code),
        );
        throw new BadRequestException(
          this.t('user.invalidRoleCodes', 'en', {
            codes: missingCodes.join(', '),
          }),
        );
      }

      // Delete existing roles and assign new ones
      await this.prisma.$transaction(async (tsx) => {
        await tsx.userRole.deleteMany({ where: { userId } });
        await tsx.userRole.createMany({
          data: roles.map((role) => ({
            userId,
            roleId: role.id,
            grantedBy: adminId,
          })),
        });
      });
    }

    this.logger.log('Admin updated user', { userId, changes: dto, adminId });
    return this.toUserResponse(await this.findByIdOrThrow(userId));
  }

  async blockUser(userId: string, adminId: string): Promise<UserResponse> {
    const user = await this.findByIdOrThrow(userId);
    const lang = user.preferredLanguage || 'en';

    if (!user.isActive) {
      throw new BadRequestException(this.t('user.alreadyInactive', lang));
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false, deactivatedBy: adminId, deletedAt: null },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.logger.log('Admin blocked user', { userId, adminId });

    await this.emailService.send({
      to: user.email,
      template: 'accountBlocked',
      lang,
      args: {
        firstName: user.firstName,
      },
    });

    return this.toUserResponse(await this.findByIdOrThrow(userId));
  }

  async unblockUser(userId: string, adminId: string): Promise<UserResponse> {
    const user = await this.findByIdOrThrow(userId);
    const lang = user.preferredLanguage || 'en';

    if (user.isActive) {
      throw new BadRequestException(this.t('user.alreadyActive', lang));
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: true,
        deactivatedBy: null,
        deletedAt: null,
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    this.logger.log('Admin unblocked user', { userId, adminId });

    await this.emailService.send({
      to: user.email,
      template: 'accountUnblocked',
      lang,
      args: {
        firstName: user.firstName,
      },
    });

    return this.toUserResponse(await this.findByIdOrThrow(userId));
  }

  // ----- Check if a user has a specific role ------------
  async hasRole(userId: string, roleCode: string): Promise<boolean> {
    const count = await this.prisma.userRole.count({
      where: {
        userId,
        role: { code: roleCode },
      },
    });
    return count > 0;
  }

  // ----- Add a role to a user --------------------------------
  async addRole(
    userId: string,
    roleCode: string,
    grantedBy?: string,
  ): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { code: roleCode },
    });
    if (!role) {
      throw new NotFoundException(`Role ${roleCode} not found`);
    }

    const existing = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId: role.id } },
    });

    if (existing) return;

    await this.prisma.userRole.create({
      data: { userId, roleId: role.id, grantedBy },
    });
    this.logger.log(`Role ${roleCode} granted to user ${userId}`);
  }

  // ----- Remove a role from a user --------------------------------
  async removeRole(userId: string, roleCode: string): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { code: roleCode },
    });
    if (!role) return;

    await this.prisma.userRole.deleteMany({
      where: { userId, roleId: role.id },
    });
    this.logger.log(`Role ${roleCode} revoked from user ${userId}`);
  }

  // ----- Find or create a client user -------------------------------
  async findOrCreateClientUser(
    email: string,
    firstName: string,
    lastName: string,
    phone?: string,
  ): Promise<{ id: string; email: string; isNew: boolean }> {
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return { id: existingUser.id, email: existingUser.email, isNew: false };
    }

    const newUser = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        firstName,
        lastName,
        phone,
        passwordHash: '', // User must reset password on first login
      },
    });

    const clientRole = await this.prisma.role.findUnique({
      where: { code: 'client' },
    });
    if (clientRole) {
      await this.prisma.userRole.create({
        data: { userId: newUser.id, roleId: clientRole.id },
      });
    }

    this.logger.log(`Client user created ${normalizedEmail}`);
    return { id: newUser.id, email: newUser.email, isNew: true };
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    return userRoles.map((ur) => ur.role.code);
  }

  // ----- Private Helpers ------------------------------------------
  private async findByIdOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: { role: { select: { code: true, name: true } } },
        },
        profile: true,
      },
    });

    if (!user) {
      throw new NotFoundException(
        this.t('user.notFound', 'fr', { id: userId }),
      );
    }

    return user;
  }

  private toUserResponse(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    isActive: boolean;
    emailVerified: boolean;
    createdAt: Date;
    lastLoginAt: Date | null;
    preferredLanguage: string;
    userRoles?: { role: { code: string } }[];
    profile: {
      avatarUrl: string | null;
      address: string | null;
      city: string | null;
      country: string | null;
      idVerified: boolean;
    } | null;
  }): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      language: user.preferredLanguage,
      roles: user.userRoles?.map((ur) => ur.role.code) || [],
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() || null,
      profile: user.profile
        ? {
            avatarUrl: user.profile?.avatarUrl || null,
            address: user.profile?.address || null,
            city: user.profile?.city || null,
            country: user.profile?.country || null,
            idVerified: user.profile?.idVerified || false,
          }
        : null,
    };
  }

  private t(key: string, lang: string, args?: Record<string, string | number>) {
    return this.i18n.translate(key, { lang, args }) as string;
  }
}
