import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedRequest } from '@kambriq/shared';
import { ProfileService } from './profile.service';
import { CreateProfileDto } from './dto/create-profile-dto';
import { UpdateProfileDto } from './dto/update-profile-dto';

@UseGuards(AuthGuard('jwt'))
@Controller('users/profile')
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateProfileDto) {
    return this.profileService.createProfile(req.user.userId, dto);
  }

  @Get('me')
  getMe(@Req() req: AuthenticatedRequest) {
    return this.profileService.getProfileByUserId(req.user.userId);
  }

  @Patch('me')
  updateMe(@Req() req: AuthenticatedRequest, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateProfile(req.user.userId, dto);
  }
}
