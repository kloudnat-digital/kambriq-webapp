import { PrismaService } from '@kambriq/db';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ScheduleExamDto } from './dto/schedule-exam.dto';
import { RescheduleExamDto } from './dto/reschedule-exam.dto';
import { CancelExamDto } from './dto/cancel-exam.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';
import { SaveAnswerDto } from './dto/save-answer.dto';

@Injectable()
export class ExamService {
  constructor(private prisma: PrismaService) {}

  // ──────────────────────────────────────────────
  // 1. Schedule Exam
  // ──────────────────────────────────────────────

  async scheduleExam(dto: ScheduleExamDto) {
    const candidate = await this.prisma.kBSCandidate.findUnique({
      where: { id: dto.candidateId },
      include: { exams: { orderBy: { createdAt: 'desc' } } },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    // Check eligibility before scheduling
    await this.checkEligibility(dto.candidateId);

    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Scheduled date must be in the future');
    }

    const attemptNumber = candidate.exams.length + 1;

    return this.prisma.kBSExam.create({
      data: {
        candidateId: dto.candidateId,
        scheduledAt,
        status: 'SCHEDULED',
        attemptNumber,
      },
    });
  }

  // ──────────────────────────────────────────────
  // 2. Check Eligibility
  // ──────────────────────────────────────────────

  async checkEligibility(candidateId: string) {
    const candidate = await this.prisma.kBSCandidate.findUnique({
      where: { id: candidateId },
      include: {
        exams: { orderBy: { createdAt: 'desc' } },
        kbsprogresses: true,
      },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    // Check if candidate has an active (non-terminal) exam
    const activeExam = candidate.exams.find((e) =>
      ['SCHEDULED', 'IN_PROGRESS'].includes(e.status),
    );
    if (activeExam) {
      throw new ConflictException(
        'Candidate already has an active exam session',
      );
    }

    // Check max attempts
    const completedAttempts = candidate.exams.filter((e) =>
      ['PASSED', 'FAILED', 'SUBMITTED'].includes(e.status),
    ).length;

    if (completedAttempts >= candidate.maxAttempts) {
      throw new ForbiddenException(
        `Maximum number of attempts (${candidate.maxAttempts}) reached`,
      );
    }

    // Check retake cooldown
    const lastFailedExam = candidate.exams.find(
      (e) => e.status === 'FAILED',
    );
    if (lastFailedExam?.submittedAt) {
      const cooldownEnd = new Date(lastFailedExam.submittedAt);
      cooldownEnd.setDate(
        cooldownEnd.getDate() + candidate.retakeCooldownDays,
      );
      if (new Date() < cooldownEnd) {
        throw new ForbiddenException(
          `Retake not allowed until ${cooldownEnd.toISOString().split('T')[0]}`,
        );
      }
    }

    // Check if all modules are completed
    const totalModules = await this.prisma.kBSModule.count();
    const completedModules = candidate.kbsprogresses.filter(
      (p) => p.completedAt !== null,
    ).length;

    if (completedModules < totalModules) {
      throw new ForbiddenException(
        `Training not complete: ${completedModules}/${totalModules} modules finished`,
      );
    }

    return {
      eligible: true,
      attemptsUsed: completedAttempts,
      attemptsRemaining: candidate.maxAttempts - completedAttempts,
    };
  }

  // ──────────────────────────────────────────────
  // 3. Start Exam
  // ──────────────────────────────────────────────

  async startExam(examId: string) {
    const exam = await this.prisma.kBSExam.findUnique({
      where: { id: examId },
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    if (exam.status !== 'SCHEDULED') {
      throw new BadRequestException(
        `Cannot start exam with status "${exam.status}"`,
      );
    }

    return this.prisma.kBSExam.update({
      where: { id: examId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });
  }

  // ──────────────────────────────────────────────
  // 4. Save Answer (auto-save during exam)
  // ──────────────────────────────────────────────

  async saveAnswer(examId: string, dto: SaveAnswerDto) {
    const exam = await this.prisma.kBSExam.findUnique({
      where: { id: examId },
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    if (exam.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Exam is not in progress');
    }

    // Check if time has expired
    this.assertExamNotExpired(exam);

    return this.prisma.kBSExamAnswer.upsert({
      where: {
        examId_questionId: {
          examId,
          questionId: dto.questionId,
        },
      },
      create: {
        examId,
        questionId: dto.questionId,
        answerId: dto.answerId ?? null,
        flagged: dto.flagged ?? false,
      },
      update: {
        answerId: dto.answerId ?? null,
        flagged: dto.flagged ?? false,
        answeredAt: new Date(),
      },
    });
  }

  // ──────────────────────────────────────────────
  // 5. Submit Exam
  // ──────────────────────────────────────────────

  async submitExam(examId: string, dto: SubmitExamDto) {
    const exam = await this.prisma.kBSExam.findUnique({
      where: { id: examId },
      include: { examAnswers: true },
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    if (exam.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Exam is not in progress');
    }

    // Save any final answers from the submission
    for (const answer of dto.answers) {
      await this.prisma.kBSExamAnswer.upsert({
        where: {
          examId_questionId: {
            examId,
            questionId: answer.questionId,
          },
        },
        create: {
          examId,
          questionId: answer.questionId,
          answerId: answer.answerId ?? null,
        },
        update: {
          answerId: answer.answerId ?? null,
          answeredAt: new Date(),
        },
      });
    }

    // Grade the exam
    return this.gradeExam(examId);
  }

  // ──────────────────────────────────────────────
  // 6. Get Exam Results
  // ──────────────────────────────────────────────

  async getExamResults(examId: string) {
    const exam = await this.prisma.kBSExam.findUnique({
      where: { id: examId },
      include: {
        examAnswers: {
          include: {
            question: { include: { module: true } },
            answer: true,
          },
        },
        candidate: true,
      },
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    if (!['PASSED', 'FAILED'].includes(exam.status)) {
      throw new BadRequestException('Exam has not been graded yet');
    }

    // Calculate per-module breakdown
    const moduleScores = new Map<
      string,
      { moduleName: string; correct: number; total: number }
    >();

    for (const ea of exam.examAnswers) {
      const moduleId = ea.question.moduleId;
      const moduleName = ea.question.module.title;

      if (!moduleScores.has(moduleId)) {
        moduleScores.set(moduleId, { moduleName, correct: 0, total: 0 });
      }

      const entry = moduleScores.get(moduleId)!;
      entry.total++;
      if (ea.answer?.isCorrect) {
        entry.correct++;
      }
    }

    const breakdown = Array.from(moduleScores.values()).map((m) => ({
      module: m.moduleName,
      correct: m.correct,
      total: m.total,
      percentage: m.total > 0 ? Math.round((m.correct / m.total) * 100) : 0,
    }));

    return {
      examId: exam.id,
      candidateId: exam.candidateId,
      attemptNumber: exam.attemptNumber,
      score: exam.score,
      passingScore: exam.passingScore,
      passed: exam.status === 'PASSED',
      status: exam.status,
      startedAt: exam.startedAt,
      submittedAt: exam.submittedAt,
      breakdown,
    };
  }

  // ──────────────────────────────────────────────
  // 7. Get Exam History
  // ──────────────────────────────────────────────

  async getExamHistory(candidateId: string) {
    const candidate = await this.prisma.kBSCandidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    const exams = await this.prisma.kBSExam.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        attemptNumber: true,
        score: true,
        passingScore: true,
        status: true,
        scheduledAt: true,
        startedAt: true,
        submittedAt: true,
        createdAt: true,
      },
    });

    return {
      candidateId,
      totalAttempts: exams.length,
      maxAttempts: candidate.maxAttempts,
      exams,
    };
  }

  // ──────────────────────────────────────────────
  // 8. Cancel Exam
  // ──────────────────────────────────────────────

  async cancelExam(examId: string, dto: CancelExamDto) {
    const exam = await this.prisma.kBSExam.findUnique({
      where: { id: examId },
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    if (!['SCHEDULED', 'UNSCHEDULED'].includes(exam.status)) {
      throw new BadRequestException(
        `Cannot cancel exam with status "${exam.status}"`,
      );
    }

    return this.prisma.kBSExam.update({
      where: { id: examId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: dto.reason ?? null,
      },
    });
  }

  // ──────────────────────────────────────────────
  // 9. Reschedule Exam
  // ──────────────────────────────────────────────

  async rescheduleExam(examId: string, dto: RescheduleExamDto) {
    const exam = await this.prisma.kBSExam.findUnique({
      where: { id: examId },
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    if (exam.status !== 'SCHEDULED') {
      throw new BadRequestException(
        `Cannot reschedule exam with status "${exam.status}"`,
      );
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Scheduled date must be in the future');
    }

    return this.prisma.kBSExam.update({
      where: { id: examId },
      data: { scheduledAt },
    });
  }

  // ──────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────

  private async gradeExam(examId: string) {
    const examAnswers = await this.prisma.kBSExamAnswer.findMany({
      where: { examId },
      include: { answer: true },
    });

    const totalQuestions = examAnswers.length;
    const correctAnswers = examAnswers.filter(
      (ea) => ea.answer?.isCorrect === true,
    ).length;

    const score =
      totalQuestions > 0
        ? Math.round((correctAnswers / totalQuestions) * 100)
        : 0;

    const exam = await this.prisma.kBSExam.findUniqueOrThrow({
      where: { id: examId },
    });

    const passed = score >= exam.passingScore;

    return this.prisma.kBSExam.update({
      where: { id: examId },
      data: {
        score,
        status: passed ? 'PASSED' : 'FAILED',
        submittedAt: new Date(),
      },
    });
  }

  private assertExamNotExpired(exam: {
    startedAt: Date | null;
    duration: number;
  }) {
    if (!exam.startedAt) return;

    const deadline = new Date(exam.startedAt);
    deadline.setMinutes(deadline.getMinutes() + exam.duration);

    if (new Date() > deadline) {
      throw new BadRequestException('Exam time has expired');
    }
  }
}
