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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  CurrentUser,
  PaginationQueryDto,
  RequestUser,
  RoleCode,
  Roles,
} from '@kambriq/common';
import { AdminUpdateUserDto, UpdateProfileDto } from './dto/users.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly usersService: UsersService) {}

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
  async updateMe(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateMe(user.id, dto);
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

  @Get(':id')
  @Roles(RoleCode.ADMIN_GLOBAL)
  @ApiOperation({
    summary: '[Admin] Get a user by ID',
    description:
      'Returns the full profile of a specific user. Requires ADMIN_GLOBAL role.',
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
    summary: '[Admin] Update a user roles',
    description:
      "Replaces the user's role set with the provided role codes. Requires ADMIN_GLOBAL role.",
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
  async adminUpdate(
    @Param('id') userId: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() admin: RequestUser,
  ) {
    return this.usersService.adminUpdate(userId, dto, admin.id);
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
  async blockUser(
    @Param('id') userId: string,
    @CurrentUser() admin: RequestUser,
  ) {
    return this.usersService.blockUser(userId, admin.id);
  }

  @Post(':id/unblock')
  @Roles(RoleCode.ADMIN_GLOBAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Admin] Unblock a user account',
    description:
      'Reactivates a previously blocked user account. Requires ADMIN_GLOBAL role.',
  })
  @ApiParam({ name: 'id', description: 'User ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({ status: 200, description: 'User unblocked successfully.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions. Requires ADMIN_GLOBAL.',
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async unblockUser(
    @Param('id') userId: string,
    @CurrentUser() admin: RequestUser,
  ) {
    return this.usersService.unblockUser(userId, admin.id);
  }
}
