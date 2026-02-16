import { PrismaService } from '@kambriq/db';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

@Injectable()
export class ModuleService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateModuleDto) {
    const existingCourse = await this.prisma.kBSCourse.findUnique({
      where: { id: dto.courseId },
    });

    if (!existingCourse) {
      throw new NotFoundException('Course not found');
    }

    return this.prisma.kBSModule.create({ data: dto });
  }

  findAll() {
    return this.prisma.kBSModule.findMany({ include: { kbslessons: true } });
  }

  findOne(id: string) {
    return this.prisma.kBSModule.findUnique({
      where: { id },
      include: { kbslessons: true },
    });
  }

  update(id: string, dto: UpdateModuleDto) {
    return this.prisma.kBSModule.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.kBSModule.delete({ where: { id } });
  }
}
