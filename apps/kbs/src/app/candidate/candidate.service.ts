import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@kambriq/db';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';

@Injectable()
export class CandidateService {
  constructor(private prisma: PrismaService) {}

  async enroll(dto: CreateCandidateDto) {
    const existing = await this.prisma.kBSCandidate.findUnique({
      where: { userId: dto.userId },
    });

    if (existing) {
      throw new ConflictException('Candidate already enrolled');
    }

    return this.prisma.kBSCandidate.create({
      data: {
        userId: dto.userId,
        sponsorId: dto.sponsorId,
        enrollMentDate: dto.enrollmentDate,
        status: dto.status,
        examDueDate: dto.examDueDate,
      },
    });
  }

  async getByUserId(userId: string) {
    const candidate = await this.prisma.kBSCandidate.findUnique({
      where: { userId },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    return candidate;
  }

  async updateCandidate(userId: string, dto: UpdateCandidateDto) {
    return this.prisma.kBSCandidate.update({
      where: { userId },
      data: dto,
    });
  }

  async listAll() {
    return this.prisma.kBSCandidate.findMany();
  }
}
