import {
  EmailService,
  EXAM_PASSING_SCORE,
  ExamStatus,
  KBS_JOBS,
  QUEUES,
  RoleCode,
} from '@kambriq/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { KbsExamService } from './exam.service';
import { UsersService } from '../../core/users/users.service';
import { KbsPrismaService } from '../prisma/kbs-prisma.service';
import { Job, Queue } from 'bullmq';
import { DateTime } from 'luxon';

@Processor(QUEUES.KBS)
export class KbsGradingProcessor extends WorkerHost {
  private readonly logger = new Logger(KbsGradingProcessor.name);

  constructor(
    private readonly examService: KbsExamService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly kbsPrisma: KbsPrismaService,
    @InjectQueue(QUEUES.KBS) private readonly kbsQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case KBS_JOBS.GRADE_EXAM:
        return this.handleGradeExam(job);
      case KBS_JOBS.GRANT_KCA_ROLE:
        return this.handleGrantKcaRole(job);
      default:
        this.logger.warn(`Unknown KBS type: ${job.name}`);
        return null;
    }
  }

  private async handleGradeExam(
    job: Job<{ examId: string; candidateId: string; userId: string }>,
  ) {
    const { examId, candidateId, userId } = job.data;
    this.logger.log('Grading Exam', { examId, candidateId, userId });

    const result = await this.examService.gradeExam(examId);
    const user = await this.usersService.findById(userId);

    const lang = user.language || 'fr';

    if (result.passed) {
      await this.kbsQueue.add(
        KBS_JOBS.GRANT_KCA_ROLE,
        { userId, examId },
        {
          jobId: `grant-kca-${userId}`,
        },
      );

      await this.emailService.send({
        to: user.email,
        template: 'examPassed',
        lang,
        args: {
          firstName: user.firstName,
          score: result.score,
          passingScore: EXAM_PASSING_SCORE,
        },
      });
    } else {
      const candidate = await this.kbsPrisma.kbsCandidate.findUnique({
        where: { id: candidateId },
      });
      const totalAttempts = await this.kbsPrisma.kbsExam.count({
        where: {
          candidateId: candidate.id,
          cycle: candidate.currentCycle,
          status: {
            in: [ExamStatus.PASSED, ExamStatus.FAILED, ExamStatus.SUBMITTED],
          },
        },
      });
      const maxAttempts = candidate.maxAttempts ?? 3;
      const cooldownDays = candidate.retakeCooldownDays ?? 7;
      const retakeDate = DateTime.now().plus({ days: cooldownDays });

      await this.emailService.send({
        to: user.email,
        template: 'examFailed',
        lang,
        args: {
          firstName: user.firstName,
          score: result.score,
          passingScore: EXAM_PASSING_SCORE,
          attemptsLeft: Math.max(0, maxAttempts - totalAttempts),
          retakeDate: retakeDate.toLocaleString(DateTime.DATE_MED, {
            locale: lang,
          }),
        },
      });
    }

    this.logger.log('Exam graded', {
      examId,
      percentage: result.score,
      candidateId,
      passed: result.passed,
    });

    return result;
  }

  private async handleGrantKcaRole(
    job: Job<{ userId: string; examId: string }>,
  ) {
    const { userId, examId } = job.data;
    this.logger.log('Granting KCA role', { userId, examId });
    await this.usersService.addRole(userId, RoleCode.KCA_CERTIFIED);
    this.logger.log('KCA role granted', { userId });
    return { userId, role: RoleCode.KCA_CERTIFIED };
  }
}
