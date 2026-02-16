import { PrismaService } from '@kambriq/db';
import { Injectable } from '@nestjs/common';
import { CreateProfileDto } from './dto/create-profile-dto';
import { UpdateProfileDto } from './dto/update-profile-dto';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async createProfile(userId: string, data: CreateProfileDto) {
    return this.prisma.profile.create({
      data: {
        userId,
        ...data,
      },
    });
  }

  async getProfileByUserId(userId: string) {
    return this.prisma.profile.findUnique({
      where: { userId },
    });
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    return this.prisma.profile.update({
      where: { userId },
      data,
    });
  }
}
