import { Module } from '@nestjs/common';
import { PrismaModule } from '@kambriq/db';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { CandidateModule } from '../candidate/candidate.module';

@Module({
  imports: [PrismaModule, CandidateModule],
  controllers: [ProgressController],
  providers: [ProgressService],
})
export class ProgressModule {}
