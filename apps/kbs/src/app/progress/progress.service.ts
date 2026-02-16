import { PrismaService } from '@kambriq/db';
import { Injectable } from '@nestjs/common';
import { CreateProgressDto } from './dto/create-progress.dto';
import { CandidateService } from '../candidate/candidate.service';

@Injectable()
export class ProgressService {
  constructor(
    private prisma: PrismaService,
    private candidateService: CandidateService,
  ) {}

  async createOrUpdate(userId: string, dto: CreateProgressDto) {
    const candidate = await this.candidateService.getByUserId(userId);

    return this.prisma.kBSProgress.upsert({
      where: {
        candidateId_moduleId: {
          candidateId: candidate.id,
          moduleId: dto.moduleId,
        },
      },
      update: {
        completedAt: dto.completedAt,
      },
      create: {
        candidateId: candidate.id,
        moduleId: dto.moduleId,
        completedAt: dto.completedAt,
      },
    });
  }

  async getProgressByCandidate(userId: string) {
    const candidate = await this.candidateService.getByUserId(userId);

    return this.prisma.kBSProgress.findMany({
      where: { candidateId: candidate.id },
      include: { module: true },
    });
  }
}
