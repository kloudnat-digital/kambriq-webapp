import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { RolesService } from '../roles/roles.service';
import { assertNotRecordDerived } from './record-derived-roles';
import { CurrentUser, PaginationQueryDto, RequestUser, RoleCode, Roles } from '@kambriq/common';
import {
  AdminUpdateUserDto,
  AvatarUploadUrlDto,
  ChangePasswordDto,
  ConfirmEmailChangeDto,
  IdDocumentUploadUrlDto,
  RequestEmailChangeDto,
  ReviewIdDocumentDto,
  RoleCodeDto,
  SubmitIdDocumentDto,
  UpdateProfileDto,
} from './dto/users.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
  ) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get authenticated user profile',
    description:
      'Returns the full profile of the currently authenticated user, including roles, profile details, and account status.',
  })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async getMe(@CurrentUser() user: RequestUser) {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update authenticated user profile',
    description:
      'Partially updates personal information (name, phone, language, avatar, address). Only provided fields are updated.',
  })
  @ApiResponse({ status: 200, description: 'Profile updated successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Post('me/avatar/upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a presigned S3 URL for avatar upload',
    description:
      'Returns { upladUrl, fileUrl }. Uplad the file directly to upladUrl, then send the fileUrl via PATCH /users/me as avatarUrl',
  })
  @ApiResponse({ status: 200, description: 'Presigned upload URL returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async getAvatarUploadUrl(@CurrentUser() user: RequestUser, @Body() dto: AvatarUploadUrlDto) {
    return this.usersService.getAvatarUploadUrl(user.id, dto);
  }

  @Post('me/id-document/upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a presigned S3 URL for ID document upload',
    description:
      'Returns { uploadUrl, fileUrl }. Upload the file directly to uploadUrl, then send the fileUrl(s) via PATCH /users/me/id-document as idDocumentUrls[].',
  })
  @ApiResponse({ status: 200, description: 'Presigned upload URL returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async getIdDocumentUploadUrl(
    @CurrentUser() user: RequestUser,
    @Body() dto: IdDocumentUploadUrlDto,
  ) {
    return this.usersService.getIdDocumentUploadUrl(user.id, dto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change authenticated user password',
    description:
      'Verifies the current password, sets the new one, and revokes all active sessions. The current session remains valid but all other devices are logged out.',
  })
  @ApiResponse({ status: 200, description: 'Password changed successfully.' })
  @ApiResponse({
    status: 400,
    description: 'Current password is incorrect, or validation error.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user.id, dto);
  }

  @Patch('me/email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request an email address change',
    description:
      'Requires the current password for re-authentication. Stores the new address as pending and sends a verification link to it. The change is not applied until confirmed.',
  })
  @ApiResponse({ status: 200, description: 'Verification email sent to new address.' })
  @ApiResponse({ status: 400, description: 'Same email, wrong password, or validation error.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 409, description: 'New email already taken by another account.' })
  async requestEmailChange(@CurrentUser() user: RequestUser, @Body() dto: RequestEmailChangeDto) {
    return this.usersService.requestEmailChange(user.id, dto);
  }

  @Post('me/email/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm email address change',
    description:
      'Validates the token sent to the new address and atomically swaps the email. All active sessions are revoked - the user must log in again with the new address.',
  })
  @ApiResponse({ status: 200, description: 'Email updated. All sessions revoked.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token, or no pending change.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 409, description: 'New email was claimed by another account.' })
  async confirmEmailChange(@CurrentUser() user: RequestUser, @Body() dto: ConfirmEmailChangeDto) {
    return this.usersService.confirmEmailChange(user.id, dto);
  }

  @Patch('me/id-document')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit identity document for verification',
    description:
      'Upload a URL to an identity document. Sets verification status to PENDING for admin review. Cannot re-submit once already verified.',
  })
  @ApiResponse({ status: 200, description: 'Document submitted for review.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Identity already verified.' })
  async submitIdDocument(@CurrentUser() user: RequestUser, @Body() dto: SubmitIdDocumentDto) {
    return this.usersService.submitIdDocument(user.id, dto);
  }

  @Patch(':id/id-document/review')
  // Restrict access to administrators authorized to verify identity documents.
  @Roles(RoleCode.ADMIN_LANDS, RoleCode.ADMIN_GLOBAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Admin] Approve or reject an identity document',
    description:
      'Sets the verification status to "verified" or "rejected". A rejection reason is required when rejecting. Sends a notification email to the user in either case.',
  })
  @ApiParam({ name: 'id', description: 'User ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Verification status updated.' })
  @ApiResponse({ status: 400, description: 'Document not in PENDING status, or missing reason.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'User has no document pending review.' })
  async reviewIdDocument(
    @Param('id') userId: string,
    @CurrentUser() admin: RequestUser,
    @Body() dto: ReviewIdDocumentDto,
  ) {
    return this.usersService.reviewIdDocument(userId, admin.id, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete authenticated user account',
    description:
      'Schedules the account for deletion and revokes all sessions. The account can be recovered within the 30-day grace period via POST /auth/reactivate. After that window, data is permanently deleted.',
  })
  @ApiResponse({
    status: 204,
    description: 'Account scheduled for deletion. All sessions revoked.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({
    status: 409,
    description:
      'You are the last active ADMIN_GLOBAL. Grant the role to another active account first.',
  })
  async deleteMe(@CurrentUser() user: RequestUser) {
    await this.usersService.deleteMe(user.id);
  }

  @Get()
  @Roles(RoleCode.ADMIN_GLOBAL)
  @ApiOperation({
    summary: '[Admin] List all users',
    description:
      'Returns a paginated, sortable list of all registered users. Requires ADMIN_GLOBAL role.',
  })
  @ApiResponse({ status: 200, description: 'Paginated user list returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions. Requires ADMIN_GLOBAL.',
  })
  async findAll(@Query() query: PaginationQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get('roles')
  @Roles(RoleCode.ADMIN_GLOBAL)
  @ApiOperation({
    summary: '[Admin] List all roles',
    description: 'Returns all defined roles in the system. Requires ADMIN_GLOBAL role.',
  })
  @ApiResponse({ status: 200, description: 'Role list returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions. Requires ADMIN_GLOBAL.',
  })
  async listRoles() {
    return this.rolesService.findAll();
  }

  @Get('id-documents/pending')
  // Ensure queue visibility for all administrators who have identity verification rights.
  @Roles(RoleCode.ADMIN_LANDS, RoleCode.ADMIN_GLOBAL)
  @ApiOperation({
    summary: '[Admin] The identity-review queue',
    description:
      'Identity documents awaiting review, oldest first. ' +
      'Includes individual waiting times and overall oldest document metrics. ' +
      'Requires ADMIN_LANDS or ADMIN_GLOBAL.',
  })
  @ApiResponse({ status: 200, description: 'Pending documents returned, oldest first.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions. Requires ADMIN_GLOBAL.' })
  async listPendingIdDocuments(@Query() query: PaginationQueryDto) {
    return this.usersService.listPendingIdDocuments(query);
  }

  @Get('id-documents/:id')
  // Provide only necessary identity details (including pre-signed document URLs) to reviewers.
  // Enforces least privilege to avoid exposing the full user account.
  @Roles(RoleCode.ADMIN_LANDS, RoleCode.ADMIN_GLOBAL)
  @ApiOperation({
    summary: '[Admin] One identity under review, with its documents',
    description:
      'Retrieve a user and pre-signed links to their submitted identity documents for review.',
  })
  @ApiParam({ name: 'id', description: 'User ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Identity under review returned.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'No such user.' })
  async getIdentityForReview(@Param('id') userId: string) {
    return this.usersService.getIdentityForReview(userId);
  }

  @Get(':id')
  @Roles(RoleCode.ADMIN_GLOBAL)
  @ApiOperation({
    summary: '[Admin] Get a user by ID',
    description: 'Returns the full profile of a specific user. Requires ADMIN_GLOBAL role.',
  })
  @ApiParam({ name: 'id', description: 'User ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({ status: 200, description: 'User found and returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions. Requires ADMIN_GLOBAL.',
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async findById(@Param('id') userId: string) {
    return this.usersService.findById(userId);
  }

  @Patch(':id')
  @Roles(RoleCode.ADMIN_GLOBAL)
  @ApiOperation({
    summary: '[Admin] Replace all roles for a user',
    description:
      'DESTRUCTIVE: Atomically replaces ALL roles with the provided list. Any role not in the list is removed. ' +
      'Use POST /users/:id/roles and DELETE /users/:id/roles/:code for non-destructive single-role changes. ' +
      'Requires ADMIN_GLOBAL role.',
  })
  @ApiParam({ name: 'id', description: 'User ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({ status: 200, description: "User's roles updated." })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions. Requires ADMIN_GLOBAL.',
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({
    status: 409,
    description:
      'The list omits ADMIN_GLOBAL and the target is the last active holder of it. ' +
      'Grant ADMIN_GLOBAL to another active account first.',
  })
  async adminUpdate(
    @Param('id') userId: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() admin: RequestUser,
  ) {
    return this.usersService.adminUpdate(userId, dto, admin.id);
  }

  @Post(':id/roles')
  @Roles(RoleCode.ADMIN_GLOBAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Admin] Grant a role to a user',
    description:
      'Adds a single role to the user without touching existing roles. Idempotent - safe to call if the user already has the role. Requires ADMIN_GLOBAL role.',
  })
  @ApiParam({ name: 'id', description: 'User ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({ status: 200, description: 'Role granted.' })
  @ApiResponse({
    status: 400,
    description: 'A role that follows a record (KCA_CERTIFIED): issue the certificate instead.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'User not found, or role code not found.' })
  async grantRole(
    @Param('id') userId: string,
    @Body() dto: RoleCodeDto,
    @CurrentUser() admin: RequestUser,
  ) {
    assertNotRecordDerived(dto.roleCode);
    await this.usersService.addRole(userId, dto.roleCode, admin.id);
    return this.usersService.findById(userId);
  }

  @Delete(':id/roles/:roleCode')
  @Roles(RoleCode.ADMIN_GLOBAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Admin] Revoke a role from a user',
    description:
      'Removes a single role from the user without touching other roles. Silently succeeds if the user does not have the role. Requires ADMIN_GLOBAL role.',
  })
  @ApiParam({ name: 'id', description: 'User ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiParam({ name: 'roleCode', description: 'Role code to remove', example: RoleCode.ADMIN_KBS })
  @ApiResponse({ status: 200, description: 'Role revoked.' })
  @ApiResponse({
    status: 400,
    description: 'A role that follows a record (KCA_CERTIFIED): revoke the certificate instead.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({
    status: 409,
    description:
      'The role is ADMIN_GLOBAL and the target is the last active holder of it. ' +
      'Grant ADMIN_GLOBAL to another active account first.',
  })
  async revokeRole(
    @Param('id') userId: string,
    @Param('roleCode') roleCode: string,
    @CurrentUser() admin: RequestUser,
  ) {
    void admin; // The service logs the revocation; the admin id is not needed there yet.
    assertNotRecordDerived(roleCode);
    await this.usersService.removeRole(userId, roleCode);
    return this.usersService.findById(userId);
  }

  @Post(':id/block')
  @Roles(RoleCode.ADMIN_GLOBAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Admin] Block a user account',
    description:
      'Deactivates the user account and revokes all active sessions. The user will be unable to log in until unblocked. Requires ADMIN_GLOBAL role.',
  })
  @ApiParam({ name: 'id', description: 'User ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({ status: 200, description: 'User blocked successfully.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions. Requires ADMIN_GLOBAL.',
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({
    status: 409,
    description:
      'The target is the last active ADMIN_GLOBAL. A blocked account cannot log in, ' +
      'so blocking it would leave the system with no usable super admin.',
  })
  async blockUser(@Param('id') userId: string, @CurrentUser() admin: RequestUser) {
    return this.usersService.blockUser(userId, admin.id);
  }

  @Post(':id/unblock')
  @Roles(RoleCode.ADMIN_GLOBAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Admin] Unblock a user account',
    description: 'Reactivates a previously blocked user account. Requires ADMIN_GLOBAL role.',
  })
  @ApiParam({ name: 'id', description: 'User ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({ status: 200, description: 'User unblocked successfully.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions. Requires ADMIN_GLOBAL.',
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async unblockUser(@Param('id') userId: string, @CurrentUser() admin: RequestUser) {
    return this.usersService.unblockUser(userId, admin.id);
  }
}
