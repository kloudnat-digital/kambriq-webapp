import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CorePrismaService } from '../prisma/core-prisma.service';
import { assertNotRecordDerived, RECORD_DERIVED_ROLES } from './record-derived-roles';
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
  DEFAULT_LANGUAGE,
  EMAIL_CHANGE_TOKEN_EXPIRY_HOURS,
  EmailService,
  GRACE_PERIOD_DAYS,
  IdVerificationStatus,
  PaginationQuery,
  RESET_TOKEN_EXPIRY_HOURS,
  RoleCode,
  SUPER_ADMIN_ROLE,
  StorageService,
  VerificationTokenType,
  buildPaginatedResponse,
  changedKeys,
  comparePassword,
  hashPassword,
  maskEmail,
  ageInDays,
  withOldestWaiting,
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

    // "Current password is incorrect" would be a lie to somebody who has never
    // had one - and a dead end, because there is nothing they can type.
    if (!user.passwordHash) {
      throw new BadRequestException(this.t('user.password.notSet', lang));
    }

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

    this.logger.log('User changed their password %o', { userId });
    return { message: this.t('user.password.changeSuccess', lang) };
  }

  // ----- Delete own account (soft delete) ----------------
  async deleteMe(userId: string): Promise<{ message: string }> {
    const user = await this.findByIdOrThrow(userId);
    const lang = user.preferredLanguage || 'en';

    await this.assertNotLastSuperAdmin(userId, 'deleting the account');

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

    this.logger.log('User deleted their account %o', { userId });
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

    /**
     * `Promise.all`, because `toUserResponse` is async.
     *
     * Without it `data` was an array of **pending Promises**, and
     * `JSON.stringify` renders a Promise as `{}`. The endpoint answered
     * `{"success":true,"data":[{},{},{}],"meta":{"total":14,…}}`: 200, correct
     * envelope, correct pagination, and no data. Every signal healthy except the
     * one carrying the answer.
     *
     * This is the same missing `await` as the verification email, which shipped
     * `?token=[object Promise]` — the second time the same mistake has reached
     * dev on a different surface. TypeScript cannot separate the two forms here
     * either: `Promise<T>[]` is a perfectly good array.
     */
    const data = await Promise.all(users.map((user) => this.toUserResponse(user)));
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

  /**
   * P11 - the core half of a public directory entry, for many agents at once.
   *
   * Three reasons this is not `findById` in a loop:
   *
   *   - `findById` returns `UserResponse`, which has **no `deletedAt`**, so the
   *     one exclusion nobody would forgive - publishing the name of somebody
   *     who deleted their account - cannot be made from it at all;
   *   - `findByIdOrThrow` includes `userRoles` and its `role` join on every
   *     call, so a directory of fifty agents would be fifty role-joined
   *     queries to render seven fields;
   *   - it throws `NotFoundException` for a missing row, and a missing core row
   *     is an ordinary reason not to list an agent, not a fault.
   *
   * `email` and `phone` are deliberately absent, though `findManyByIds` above
   * returns both. This feeds an anonymous page, and a projection that carries a
   * field is one careless spread away from publishing it.
   */
  async findDirectoryUsers(ids: string[]) {
    if (ids.length === 0) return [];
    return this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        isActive: true,
        deletedAt: true,
        profile: { select: { city: true, country: true, avatarUrl: true } },
      },
    });
  }

  // ----- Admin: Update user (active status, roles) -------
  /**
   * The system must never be left without a super admin.
   *
   * There are three doors out of the top role and they do not look alike, which
   * is the whole problem. Deletion is the obvious one. Revoking the role is the
   * one people think of second. **Replacing the role set is the one that gets
   * forgotten**, because `PATCH /users/:id` with a `roleCodes` list that simply
   * omits `ADMIN_GLOBAL` reads as an edit, not as a removal - and it is the same
   * outcome, arriving through a door nobody was watching.
   *
   * Blocking counts too. A blocked super admin cannot log in, so an account that
   * still holds the role administers nothing; leaving that door open would make
   * the guard true about the database and false about the system.
   *
   * "Last" is counted over holders who can actually act: active, not
   * soft-deleted. A demotion is refused only when it would take that count to
   * zero, so an ordinary demotion of one admin among several is untouched.
   */
  private async assertNotLastSuperAdmin(userId: string, action: string): Promise<void> {
    const holdsIt = await this.hasRole(userId, SUPER_ADMIN_ROLE);
    if (!holdsIt) return;

    const otherHolders = await this.prisma.user.count({
      where: {
        id: { not: userId },
        isActive: true,
        deletedAt: null,
        userRoles: { some: { role: { code: SUPER_ADMIN_ROLE } } },
      },
    });

    if (otherHolders > 0) return;

    this.logger.warn('Refused %s: it would remove the last super admin %o', action, {
      userId,
      role: SUPER_ADMIN_ROLE,
    });

    throw new ConflictException(
      `Refused: ${userId} is the last active ${SUPER_ADMIN_ROLE}, and ${action} would leave the ` +
        `system with no super admin. Grant ${SUPER_ADMIN_ROLE} to another active account first.`,
    );
  }

  async adminUpdate(
    userId: string,
    dto: AdminUpdateUserDto,
    adminId: string,
  ): Promise<UserResponse> {
    if (dto.roleCodes) {
      // The replace door. A `roleCodes` list that omits the top role removes it
      // just as surely as the revoke endpoint does, and looks nothing like a
      // removal at the call site.
      if (!dto.roleCodes.includes(SUPER_ADMIN_ROLE)) {
        await this.assertNotLastSuperAdmin(userId, 'replacing the role set');
      }

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

      // I15 - a role that follows a record may be carried through a replace
      // unchanged, never added or dropped by one.
      const current = (await this.findByIdOrThrow(userId)).userRoles.map((ur) => ur.role.code);
      for (const code of RECORD_DERIVED_ROLES.keys()) {
        if (current.includes(code) !== dto.roleCodes.includes(code)) assertNotRecordDerived(code);
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

    // Log which fields changed, never their values: the DTO can carry an email,
    // a phone number, a name or a role change.
    this.logger.log('Admin updated user %o', { userId, changed: changedKeys(dto), adminId });
    return await this.toUserResponse(await this.findByIdOrThrow(userId));
  }

  async blockUser(userId: string, adminId: string): Promise<UserResponse> {
    const user = await this.findByIdOrThrow(userId);
    const lang = user.preferredLanguage || 'en';

    if (!user.isActive) {
      throw new BadRequestException(this.t('user.alreadyInactive', lang));
    }

    await this.assertNotLastSuperAdmin(userId, 'blocking the account');

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false, deactivatedBy: adminId, deletedAt: null },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.logger.log('Admin blocked user %o', { userId, adminId });

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

    this.logger.log('Admin unblocked user %o', { userId, adminId });

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

  /**
   * The identity-review queue: everything waiting, oldest first, with its age.
   *
   * A10. The reviewer route and the reviewer role both existed; **the queue did
   * not.** `PATCH /users/:id/id-document/review` has never been called once, and
   * the only way to find a pending document was to page through every user and
   * look. 59 sat there, growing by one per deploy, and nothing counted them.
   *
   * Same principle as the payments en souffrance: nothing may sit indefinitely
   * with nobody accountable. This is what makes the backlog answerable - a
   * count, an age, and an oldest.
   */
  async listPendingIdDocuments(query: PaginationQuery) {
    const { page, limit } = query;
    const where = { idVerificationStatus: IdVerificationStatus.PENDING };

    const [profiles, total, oldest] = await this.prisma.$transaction([
      this.prisma.userProfile.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        // Oldest first, deliberately: a queue sorted newest-first hides the
        // thing that has been waiting longest, which is the only row that
        // matters.
        orderBy: { idSubmittedAt: 'asc' },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.userProfile.count({ where }),
      this.prisma.userProfile.findFirst({
        where,
        orderBy: { idSubmittedAt: 'asc' },
        select: { idSubmittedAt: true },
      }),
    ]);

    const now = Date.now();

    const response = buildPaginatedResponse(
      profiles.map((p) => ({
        userId: p.userId,
        email: p.user.email,
        firstName: p.user.firstName,
        lastName: p.user.lastName,
        documentCount: p.idDocumentUrls.length,
        submittedAt: p.idSubmittedAt,
        waitingDays: ageInDays(p.idSubmittedAt, now),
      })),
      total,
      page,
      limit,
    );

    // The age of the oldest, on the envelope. A count alone answers "how many";
    // it does not answer "how long has somebody been waiting", which is the
    // question a backlog has to be able to answer. Shared with the payment
    // request and dunning queues since G6 - see `withOldestWaiting`.
    return withOldestWaiting(response, oldest?.idSubmittedAt ?? null, now);
  }

  /**
   * One person under identity review, with their documents readable.
   *
   * Deliberately narrower than `findOne`: name, contact, city, status and
   * signed document links. No roles, no account flags, nothing a reviewer does
   * not need in order to decide whether a photograph of an identity card
   * belongs to the person named on the reservation.
   */
  async getIdentityForReview(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        profile: {
          select: {
            idDocumentUrls: true,
            idVerificationStatus: true,
            idSubmittedAt: true,
            idRejectionReason: true,
            city: true,
            country: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException(this.t('user.notFound', 'en'));

    // Signed here, in parallel: raw S3 keys cannot be opened, and a reviewer
    // handed `id-docs/abc/passport.jpg` cannot look at the passport.
    const idDocumentUrls = await Promise.all(
      (user.profile?.idDocumentUrls ?? []).map((key) => this.storage.getDownloadUrl(key)),
    );

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      profile: user.profile
        ? {
            idDocumentUrls,
            idVerificationStatus: user.profile.idVerificationStatus,
            idSubmittedAt: user.profile.idSubmittedAt,
            idRejectionReason: user.profile.idRejectionReason,
            city: user.profile.city,
            country: user.profile.country,
          }
        : null,
    };
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

    if (roleCode === SUPER_ADMIN_ROLE) {
      await this.assertNotLastSuperAdmin(userId, 'revoking the role');
    }

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

    /**
     * `RoleCode.CLIENT`, not `'client'`.
     *
     * This read `where: { code: 'client' }` while the stored code is `'CLIENT'`.
     * Postgres comparison is case-sensitive, so the lookup returned `null` and
     * the `if` below swallowed it: the client was created with **no roles at
     * all**. `@Roles(RoleCode.CLIENT)` gates the whole client portal, so the
     * reservation returned 201, the portal-access email sent, the job was green,
     * and the only symptom was a person who could not get into the thing they
     * had just been invited to.
     *
     * The missing role is now a failure rather than a silence. A client user
     * without the client role is not a user worth keeping: the row would exist,
     * the email would promise access, and the access would not be there. It is
     * looked up first, so an existing user is refused for the same reason.
     */
    const clientRole = await this.prisma.role.findUnique({
      where: { code: RoleCode.CLIENT },
    });
    if (!clientRole) {
      throw new Error(
        `Cannot create a client user: the ${RoleCode.CLIENT} role is missing from the database.`,
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    /**
     * I19 - an existing account reserved as a client becomes a client.
     *
     * It used to come back unchanged. Unless it already held CLIENT, the person
     * now owned a reservation the client portal would not show them. Granting
     * is idempotent, so an account that already holds the role is untouched.
     */
    if (existingUser) {
      const held = await this.prisma.userRole.findUnique({
        where: { userId_roleId: { userId: existingUser.id, roleId: clientRole.id } },
      });
      if (!held) {
        await this.prisma.userRole.create({
          data: { userId: existingUser.id, roleId: clientRole.id },
        });
        this.logger.log(`Role ${RoleCode.CLIENT} granted to existing user ${existingUser.id}`);
      }
      return { id: existingUser.id, email: existingUser.email, isNew: false };
    }

    const newUser = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        firstName,
        lastName,
        phone,
        // Null, not `''`. The column is nullable precisely so that "no password
        // has ever been set" is a value the schema can hold, instead of a
        // sentinel every reader has to recognise.
        passwordHash: null,
      },
    });

    await this.prisma.userRole.create({
      data: { userId: newUser.id, roleId: clientRole.id },
    });

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

    if (!user.passwordHash) {
      throw new BadRequestException(this.t('user.password.notSet', lang));
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

    this.logger.log('Email change requested %o', { userId, newEmail: maskEmail(newEmail) });
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

    this.logger.log('Email change confirmed %o', {
      userId,
      oldEmail: maskEmail(oldEmail),
      newEmail: maskEmail(newEmail),
    });
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
        idSubmittedAt: new Date(),
      },
      update: {
        idDocumentUrls: dto.idDocumentUrls,
        idVerificationStatus: IdVerificationStatus.PENDING,
        idSubmittedAt: new Date(),
        idRejectionReason: null,
        idVerifiedAt: null,
        idVerifiedBy: null,
      },
    });

    this.logger.log('ID document submitted %o', { userId });
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

    this.logger.log('ID document reviewed %o', { userId, status: dto.status, adminId });
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
      idDocumentUrls: string[];
      idVerificationStatus: string;
      idVerifiedAt: Date | null;
    } | null;
  }): Promise<UserResponse> {
    const avatarUrl = user.profile?.avatarUrl
      ? await this.storage.getDownloadUrl(user.profile.avatarUrl)
      : null;

    /**
     * Identity documents are signed, like the avatar beside them.
     *
     * They were returned as raw S3 keys - unopenable by anything that received
     * them. A reviewer handed `id-docs/abc/passport.jpg` cannot look at the
     * passport, and A14 asks somebody to decide whether a document is genuine.
     * A review screen that cannot show the document turns "verified" into a
     * click, which is worse than no review at all because it produces a record
     * saying somebody checked.
     *
     * Signed in parallel: a client may submit several, and awaiting them one at
     * a time is the `map` without `await` defect's mirror image - correct, and
     * needlessly serial.
     */
    const idDocumentUrls = await Promise.all(
      // `?? []` and not `user.profile ? ... : []`: a profile row can exist with
      // the column absent from the selection, and the shorter form read that as
      // "no profile" while it was really "not asked for".
      (user.profile?.idDocumentUrls ?? []).map((key) => this.storage.getDownloadUrl(key)),
    );

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
            idDocumentUrls,
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
