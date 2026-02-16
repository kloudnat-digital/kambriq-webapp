import { PrismaService } from '@kambriq/db';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CourseService {
  constructor(private prisma: PrismaService) {}

  createCourse(dto: CreateCourseDto) {
    return this.prisma.kBSCourse.create({ data: dto });
  }

  getAllCourses() {
    return this.prisma.kBSCourse.findMany();
  }

  getCourseById(id: string) {
    return this.prisma.kBSCourse.findUnique({ where: { id } });
  }

  updateCourse(id: string, dto: UpdateCourseDto) {
    const existingCourse = this.prisma.kBSCourse.findUnique({ where: { id } });
    if (!existingCourse) {
      throw new NotFoundException('Course not found');
    }
    return this.prisma.kBSCourse.update({ where: { id }, data: dto });
  }

  deleteCourse(id: string) {
    const existingCourse = this.prisma.kBSCourse.findUnique({ where: { id } });
    if (!existingCourse) {
      throw new NotFoundException('Course not found');
    }
    return this.prisma.kBSCourse.delete({ where: { id } });
  }
}
