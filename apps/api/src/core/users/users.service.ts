import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CorePrismaService } from '../prisma/core-prisma.service';
import {
  AdminUpdateUserDto,
  AvatarUploadUrlDto,
  ChangePasswordDto,
  ConfirmEmailChangeDto,
  IdDocumentUploadUrlDto,
  RequestEmailChangeDto,
  ReviewIdDocumentDto,
  SubmitIdDocumentDto,
  UpdateProfileDto,
  UserResponse,
} from './dto/users.dto';
import {
  buildPaginatedResponse,
  comparePassword,
  DEFAULT_LANGUAGE,
  EMAIL_CHANGE_TOKEN_EXPIRY_HOURS,
  EmailService,
  GRACE_PERIOD_DAYS,
  hashPassword,
  IdVerificationStatus,
  PaginationQuery,
  RESET_TOKEN_EXPIRY_HOURS,
  StorageService,
  VerificationTokenType,
} from '@kambriq/common';
import { I18nService } from 'nestjs-i18n';
import crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
  private logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: CorePrismaService,
    private readonly emailService: EmailService,
    private readonly i18n: I18nService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {}

  // ----- Get Me ------------------------------------------
  async getMe(userId: string): Promise<UserResponse> {
    return await this.toUserResponse(await this.findByIdOrThrow(userId));
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
    if (dto.emailNotifications !== undefined)
      profileFields.emailNotifications = dto.emailNotifications;
    if (dto.whatsappNotifications !== undefined)
      profileFields.whatsappNotifications = dto.whatsappNotifications;

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

  // ----- Get avatar upload URL ---------------------------------------
  async getAvatarUploadUrl(userId: string, dto: AvatarUploadUrlDto) {
    const timestamp = Date.now();
    const name = dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = this.storage.buildKey('users', userId, 'avatar', `${timestamp}-${name}`);
    return this.storage.getUploadUrl(key, dto.contentType);
  }

  // ----- Get ID Document upload URL ---------------------------------------
  async getIdDocumentUploadUrl(userId: string, dto: IdDocumentUploadUrlDto) {
    const timestamp = Date.now();
    const name = dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = this.storage.buildKey('users', userId, 'id-documents', `${timestamp}-${name}`);
    return this.storage.getUploadUrl(key, dto.contentType);
  }

  // ----- Change own password -----------------------------
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        passwordHash: true,
        preferredLanguage: true,
        email: true,
        firstName: true,
      },
    });

    if (!user) {
      throw new NotFoundException(this.t('user.notFound', DEFAULT_LANGUAGE, { id: userId }));
    }

    const lang = user.preferredLanguage || 'fr';

    const isCurrentValid = await comparePassword(dto.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new BadRequestException(this.t('user.password.incorrectCurrent', lang));
    }

    const newHash = await hashPassword(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash },
      }),
      // Revoke all active refresh tokens - other devices must re-login
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.emailService.send({
      to: user.email,
      template: 'passwordResetConfirmation',
      lang,
      args: { firstName: user.firstName },
    });

    this.logger.log('User changed their password', { userId });
    return { message: this.t('user.password.changeSuccess', lang) };
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
    return await this.toUserResponse(await this.findByIdOrThrow(userId));
  }

  // ----- Internal: Get Users by ID ---------------------------
  async findManyByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    });
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
        const missingCodes = dto.roleCodes.filter((code) => !foundCodes.includes(code));
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
    return await this.toUserResponse(await this.findByIdOrThrow(userId));
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

    return await this.toUserResponse(await this.findByIdOrThrow(userId));
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

    return await this.toUserResponse(await this.findByIdOrThrow(userId));
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
  async addRole(userId: string, roleCode: string, grantedBy?: string): Promise<void> {
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

    // Generate a password-reset token so the user can set their password on first login
    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    await this.prisma.verificationToken.create({
      data: {
        userId: newUser.id,
        token: rawToken,
        type: VerificationTokenType.PASSWORD_RESET,
        expiresAt,
      },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3001');
    const setPasswordUrl = `${frontendUrl}/auth/set-password?token=${rawToken}`;

    await this.emailService.send({
      to: newUser.email,
      template: 'inviteUser',
      lang: 'fr',
      args: { firstName, setPasswordUrl },
    });

    this.logger.log(`Client user created and invite sent to ${normalizedEmail}`);
    return { id: newUser.id, email: newUser.email, isNew: true };
  }

  // ----- Request email change ------------------------------------
  async requestEmailChange(
    userId: string,
    dto: RequestEmailChangeDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, passwordHash: true, preferredLanguage: true, firstName: true },
    });
    if (!user) {
      throw new NotFoundException(this.t('user.notFound', DEFAULT_LANGUAGE, { id: userId }));
    }

    const lang = user.preferredLanguage || 'fr';
    const newEmail = dto.newEmail.trim().toLowerCase();

    if (newEmail === user.email) {
      throw new BadRequestException(this.t('user.email.sameAsCurrent', lang));
    }

    const isPasswordValid = await comparePassword(dto.currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestException(this.t('user.password.incorrectCurrent', lang));
    }

    const taken = await this.prisma.user.findUnique({ where: { email: newEmail } });
    if (taken) {
      throw new ConflictException(this.t('user.email.alreadyTaken', lang));
    }

    // Invalidate any previous pending email-change tokens
    await this.prisma.verificationToken.updateMany({
      where: { userId, type: VerificationTokenType.EMAIL_CHANGE, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { pendingEmail: newEmail } }),
      this.prisma.verificationToken.create({
        data: { userId, token: rawToken, type: VerificationTokenType.EMAIL_CHANGE, expiresAt },
      }),
    ]);

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3001');
    const confirmUrl = `${frontendUrl}/auth/confirm-email-change?token=${rawToken}`;

    await this.emailService.send({
      to: newEmail,
      template: 'emailChangeRequest',
      lang,
      args: { firstName: user.firstName, newEmail, confirmUrl },
    });

    this.logger.log('Email change requested', { userId, newEmail });
    return { message: this.t('user.email.changeRequested', lang) };
  }

  // ----- Confirm email change ------------------------------------
  async confirmEmailChange(
    userId: string,
    dto: ConfirmEmailChangeDto,
  ): Promise<{ message: string }> {
    const tokenRecord = await this.prisma.verificationToken.findUnique({
      where: { token: dto.token },
    });

    if (
      !tokenRecord ||
      tokenRecord.userId !== userId ||
      tokenRecord.type !== VerificationTokenType.EMAIL_CHANGE ||
      tokenRecord.usedAt ||
      tokenRecord.expiresAt < new Date()
    ) {
      throw new BadRequestException(this.t('user.email.invalidToken', DEFAULT_LANGUAGE));
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, pendingEmail: true, preferredLanguage: true, firstName: true },
    });
    if (!user?.pendingEmail) {
      throw new BadRequestException(
        this.t('user.email.noPendingChange', user?.preferredLanguage || 'fr'),
      );
    }

    const lang = user.preferredLanguage || 'fr';
    const oldEmail = user.email;
    const newEmail = user.pendingEmail;

    // Final uniqueness check (edge case: someone registered with the new email during the window)
    const taken = await this.prisma.user.findUnique({ where: { email: newEmail } });
    if (taken) {
      throw new ConflictException(this.t('user.email.alreadyTaken', lang));
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { email: newEmail, pendingEmail: null, emailVerified: true },
      }),
      this.prisma.verificationToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all sessions - the user must re-login with new email
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    // Security notification to old address
    await this.emailService.send({
      to: oldEmail,
      template: 'emailChangeConfirm',
      lang,
      args: { firstName: user.firstName, newEmail },
    });

    this.logger.log('Email change confirmed', { userId, oldEmail, newEmail });
    return { message: this.t('user.email.changeSuccess', lang) };
  }

  // ----- Submit ID document (user) --------------------------------
  async submitIdDocument(userId: string, dto: SubmitIdDocumentDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLanguage: true, profile: { select: { idVerificationStatus: true } } },
    });
    if (!user) {
      throw new NotFoundException(this.t('user.notFound', DEFAULT_LANGUAGE, { id: userId }));
    }

    const lang = user.preferredLanguage || 'fr';

    if (user.profile?.idVerificationStatus === IdVerificationStatus.VERIFIED) {
      throw new ForbiddenException(this.t('user.idVerification.alreadyVerified', lang));
    }

    await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        idDocumentUrls: dto.idDocumentUrls,
        idVerificationStatus: IdVerificationStatus.PENDING,
      },
      update: {
        idDocumentUrls: dto.idDocumentUrls,
        idVerificationStatus: IdVerificationStatus.PENDING,
        idRejectionReason: null,
        idVerifiedAt: null,
        idVerifiedBy: null,
      },
    });

    this.logger.log('ID document submitted', { userId });
    return this.getMe(userId);
  }

  // ----- Admin: review ID document --------------------------------
  async reviewIdDocument(
    userId: string,
    adminId: string,
    dto: ReviewIdDocumentDto,
  ): Promise<{ message: string }> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      include: { user: { select: { email: true, firstName: true, preferredLanguage: true } } },
    });

    if (!profile || profile.idDocumentUrls.length === 0) {
      throw new NotFoundException(this.t('user.idVerification.noDocument', 'en'));
    }

    if (profile.idVerificationStatus !== IdVerificationStatus.PENDING) {
      throw new BadRequestException(
        this.t('user.idVerification.notPending', 'en', { status: profile.idVerificationStatus }),
      );
    }

    const isVerified = dto.status === IdVerificationStatus.VERIFIED;
    await this.prisma.userProfile.update({
      where: { userId },
      data: {
        idVerificationStatus: dto.status,
        idVerifiedAt: isVerified ? new Date() : null,
        idVerifiedBy: isVerified ? adminId : null,
        idRejectionReason: isVerified ? null : dto.rejectionReason,
      },
    });

    const lang = profile.user.preferredLanguage || 'fr';
    const template = isVerified ? 'idVerified' : 'idRejected';

    await this.emailService.send({
      to: profile.user.email,
      template,
      lang,
      args: {
        firstName: profile.user.firstName,
        ...(isVerified ? {} : { reason: dto.rejectionReason ?? '' }),
      },
    });

    this.logger.log('ID document reviewed', { userId, status: dto.status, adminId });
    return {
      message: this.t('user.idVerification.statusUpdated', DEFAULT_LANGUAGE, {
        status: dto.status,
      }),
    };
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
      throw new NotFoundException(this.t('user.notFound', DEFAULT_LANGUAGE, { id: userId }));
    }

    return user;
  }

  private async toUserResponse(user: {
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
      emailNotifications: boolean;
      whatsappNotifications: boolean;
      idDocumentUrls: string[];
      idVerificationStatus: string;
      idVerifiedAt: Date | null;
    } | null;
  }): Promise<UserResponse> {
    const avatarUrl = user.profile?.avatarUrl
      ? await this.storage.getDownloadUrl(user.profile.avatarUrl)
      : null;

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
            avatarUrl,
            city: user.profile.city || null,
            address: user.profile.address || null,
            country: user.profile.country || null,
            emailNotifications: user.profile.emailNotifications,
            whatsappNotifications: user.profile.whatsappNotifications,
            idDocumentUrls: user.profile.idDocumentUrls,
            idVerificationStatus: user.profile.idVerificationStatus,
            idVerifiedAt: user.profile.idVerifiedAt?.toISOString() || null,
          }
        : null,
    };
  }

  private t(key: string, lang: string, args?: Record<string, string | number>) {
    return this.i18n.translate(key, { lang, args }) as string;
  }
}
