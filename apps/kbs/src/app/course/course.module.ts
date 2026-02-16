import { Module } from '@nestjs/common';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { PrismaModule } from '@kambriq/db';

@Module({
  imports: [PrismaModule],
  providers: [CourseService],
  controllers: [CourseController],
  exports: [CourseService],
})
export class CourseModule {}
