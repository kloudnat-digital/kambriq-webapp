import { Module } from '@nestjs/common';
import { LessonService } from './lesson.service';
import { LessonController } from './lesson.controller';
import { PrismaModule } from '@kambriq/db';

@Module({
  imports: [PrismaModule],
  providers: [LessonService],
  controllers: [LessonController],
  exports: [LessonService],
})
export class LessonModule {}
