import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CandidateController } from './candidate/candidate.controller';
import { CandidateService } from './candidate/candidate.service';
import { CandidateModule } from './candidate/candidate.module';
import { PrismaModule } from '@kambriq/db';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@kambriq/core/auth';
import { CourseModule } from './course/course.module';
import { ModuleModule } from './module/module.module';
import { LessonModule } from './lesson/lesson.module';
import { ProgressModule } from './progress/progress.module';
import { ExamModule } from './exam/exam.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CandidateModule,
    PrismaModule,
    AuthModule,
    CourseModule,
    ModuleModule,
    LessonModule,
    ProgressModule,
    ExamModule,
  ],
  controllers: [AppController, CandidateController],
  providers: [AppService, CandidateService],
})
export class AppModule {}
