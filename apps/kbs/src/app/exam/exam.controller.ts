import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ExamService } from './exam.service';
import { ScheduleExamDto } from './dto/schedule-exam.dto';
import { RescheduleExamDto } from './dto/reschedule-exam.dto';
import { CancelExamDto } from './dto/cancel-exam.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';
import { SaveAnswerDto } from './dto/save-answer.dto';

@Controller('exam')
export class ExamController {
  constructor(private readonly examService: ExamService) {}

  /** Schedule a new exam for a candidate */
  @Post('schedule')
  scheduleExam(@Body() dto: ScheduleExamDto) {
    return this.examService.scheduleExam(dto);
  }

  /** Check if a candidate is eligible to take the exam */
  @Get('eligibility/:candidateId')
  checkEligibility(@Param('candidateId') candidateId: string) {
    return this.examService.checkEligibility(candidateId);
  }

  /** Start an exam session */
  @Patch(':examId/start')
  startExam(@Param('examId') examId: string) {
    return this.examService.startExam(examId);
  }

  /** Auto-save a single answer during the exam */
  @Post(':examId/answer')
  saveAnswer(
    @Param('examId') examId: string,
    @Body() dto: SaveAnswerDto,
  ) {
    return this.examService.saveAnswer(examId, dto);
  }

  /** Submit the exam for grading */
  @Post(':examId/submit')
  submitExam(
    @Param('examId') examId: string,
    @Body() dto: SubmitExamDto,
  ) {
    return this.examService.submitExam(examId, dto);
  }

  /** Get graded results for an exam */
  @Get(':examId/results')
  getExamResults(@Param('examId') examId: string) {
    return this.examService.getExamResults(examId);
  }

  /** Get all exam attempts for a candidate */
  @Get('history/:candidateId')
  getExamHistory(@Param('candidateId') candidateId: string) {
    return this.examService.getExamHistory(candidateId);
  }

  /** Reschedule a scheduled exam */
  @Patch(':examId/reschedule')
  rescheduleExam(
    @Param('examId') examId: string,
    @Body() dto: RescheduleExamDto,
  ) {
    return this.examService.rescheduleExam(examId, dto);
  }

  /** Cancel a scheduled exam */
  @Patch(':examId/cancel')
  cancelExam(
    @Param('examId') examId: string,
    @Body() dto: CancelExamDto,
  ) {
    return this.examService.cancelExam(examId, dto);
  }
}
