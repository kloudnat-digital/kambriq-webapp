import { PrismaService } from '@kambriq/db';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@Injectable()
export class LessonService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateLessonDto) {
    const existingModule = await this.prisma.kBSModule.findUnique({
      where: { id: dto.moduleId },
    });

    if (!existingModule) {
      throw new NotFoundException('Module not found');
    }

    return this.prisma.kBSLesson.create({ data: dto });
  }

  findAll() {
    return this.prisma.kBSLesson.findMany();
  }

  findOne(id: string) {
    return this.prisma.kBSLesson.findUnique({ where: { id } });
  }

  update(id: string, dto: UpdateLessonDto) {
    return this.prisma.kBSLesson.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.kBSLesson.delete({ where: { id } });
  }
}
