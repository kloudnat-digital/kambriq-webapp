import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { KbsCoursesService } from '../courses/courses.service';
import { KbsCandidatesService } from '../candidates/candidates.service';
import { KbsExamService } from '../exam/exam.service';
import { KbsCertificatesService } from '../certificates/certificates.service';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser, RequestUser } from '@kambriq/common';
import { EnrollDto, SubmitQuizDto } from '../candidates/dto/candidate.dto';
import {
  RescheduleExamDto,
  SaveAnswerDto,
  SubmitExamDto,
} from '../exam/dto/exam.dto';

@ApiTags('KBS - Candidate')
@ApiBearerAuth()
@Controller('kbs')
export class KbsCandidateController {
  constructor(
    private readonly coursesService: KbsCoursesService,
    private readonly candidatesService: KbsCandidatesService,
    private readonly examService: KbsExamService,
    private readonly certificateService: KbsCertificatesService,
  ) {}

  @Post('enroll')
  @ApiOperation({
    summary: 'Enroll in the KBS training program',
    description:
      'Creates a candidate profile and assigns the CANDIDATE_KBS role. Each user can only enroll once.',
  })
  @ApiResponse({
    status: 201,
    description: 'Enrolled successfully. Returns the new candidate profile.',
  })
  @ApiResponse({ status: 400, description: 'User is already enrolled in KBS.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async enroll(@CurrentUser() user: RequestUser, @Body() dto: EnrollDto) {
    return this.candidatesService.enroll(user.id, dto);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Get my KBS candidate profile',
    description:
      'Returns the candidate profile including overall training progress percentage, module-by-module progress, and certificate details if available.',
  })
  @ApiResponse({ status: 200, description: 'Candidate profile returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'User is not enrolled in KBS.' })
  async getMyProfile(@CurrentUser() user: RequestUser) {
    return this.candidatesService.getMyProfile(user.id);
  }

  @Get('courses')
  @ApiOperation({
    summary: 'List all published courses',
    description: 'Returns all KBS courses that are published and available to candidates.',
  })
  @ApiResponse({ status: 200, description: 'Published courses returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async listCourses() {
    return this.coursesService.findAllCourses();
  }

  @Get('courses/:courseId/modules')
  @ApiOperation({
    summary: 'Get modules for a course with personal progress',
    description:
      'Returns all modules for a course. If the user is enrolled in KBS, each module includes their quiz completion status and score.',
  })
  @ApiParam({ name: 'courseId', description: 'Course ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({
    status: 200,
    description:
      'Module list returned, with progress indicators for enrolled candidates.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'Course not found.' })
  async getCourseModules(
    @CurrentUser() user: RequestUser,
    @Param('courseId') courseId: string,
  ) {
    const candidate = await this.candidatesService.findByUserId(user.id);
    if (!candidate) {
      return this.coursesService.findModulesByCourseId(courseId);
    }
    return this.coursesService.findModulesWithProgress(courseId, candidate.id);
  }

  @Get('lesson/:lessonId')
  @ApiOperation({
    summary: 'Get lesson content',
    description:
      'Returns the full lesson including content URL (video, PDF, etc.) and metadata.',
  })
  @ApiParam({ name: 'lessonId', description: 'Lesson ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({ status: 200, description: 'Lesson content returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'Lesson not found.' })
  async getLessonContent(@Param('lessonId') lessonId: string) {
    return this.coursesService.findLessonById(lessonId);
  }

  @Post('lesson/:lessonId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a lesson as completed',
    description:
      'Records that the candidate has finished viewing a lesson. Idempotent. Returns module-level completion progress.',
  })
  @ApiParam({ name: 'lessonId', description: 'Lesson ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({ status: 200, description: 'Lesson marked complete. Returns module progress.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'Lesson not found.' })
  async markLessonComplete(
    @CurrentUser() user: RequestUser,
    @Param('lessonId') lessonId: string,
  ) {
    const candidate = await this.candidatesService.findByUserId(user.id);
    if (!candidate) {
      return { lessonId, completed: true }; // Not enrolled — still record nothing, just OK
    }
    return this.coursesService.markLessonComplete(candidate.id, lessonId);
  }

  @Get('modules/:moduleId/quiz')
  @ApiOperation({
    summary: 'Get the quiz for a module',
    description:
      "Returns the module quiz questions without revealing correct answers. Questions are randomly sampled from the module's pool.",
  })
  @ApiParam({ name: 'moduleId', description: 'Module ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({
    status: 200,
    description: 'Quiz questions returned (correct answers hidden).',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'Module or quiz not found.' })
  async getModuleQuiz(@Param('moduleId') moduleId: string) {
    return this.coursesService.findQuestionsForQuiz(moduleId);
  }

  @Post('modules/:moduleId/quiz')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit answers for a module quiz',
    description:
      'Grades the submitted answers immediately. Passing score is 70%. Returns score, pass/fail status, and correct answer breakdown.',
  })
  @ApiParam({ name: 'moduleId', description: 'Module ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({
    status: 200,
    description: 'Quiz graded. Returns score, passed status, and answer breakdown.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid answers or missing required questions.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'Module or quiz not found.' })
  async submitQuiz(
    @CurrentUser() user: RequestUser,
    @Param('moduleId') moduleId: string,
    @Body() dto: SubmitQuizDto,
  ) {
    return this.candidatesService.submitQuiz(user.id, moduleId, dto);
  }

  @Get('exam/eligibility')
  @ApiOperation({
    summary: 'Check final exam eligibility',
    description:
      'Returns whether the candidate can schedule the final exam. If not eligible, includes the list of modules still requiring completion.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Returns { eligible: boolean, reason?: string, requiredModules?: [] }.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'Candidate not enrolled in KBS.' })
  async checkExamEligibility(@CurrentUser() user: RequestUser) {
    return this.examService.checkEligibility(user.id);
  }

  @Post('exam/schedule')
  @ApiOperation({
    summary: 'Schedule the final exam',
    description:
      'Creates a scheduled exam session. The candidate must be eligible (all module quizzes passed). Returns the exam record with the scheduled time.',
  })
  @ApiResponse({
    status: 201,
    description: 'Exam scheduled. Returns the exam record with scheduled time.',
  })
  @ApiResponse({
    status: 403,
    description: 'Candidate is not eligible for the final exam.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async getFinalExam(@CurrentUser() user: RequestUser) {
    return this.examService.scheduleExam(user.id);
  }

  @Patch('exam/:examId/reschedule')
  @ApiOperation({
    summary: 'Reschedule a scheduled exam',
    description:
      'Changes the scheduled time of an exam that has not yet started. The new date must be in the future.',
  })
  @ApiParam({ name: 'examId', description: 'Exam ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({ status: 200, description: 'Exam rescheduled.' })
  @ApiResponse({
    status: 400,
    description:
      'New date must be in the future, or exam is not in SCHEDULED status.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({
    status: 404,
    description: 'Exam not found or does not belong to this candidate.',
  })
  async rescheduleExam(
    @CurrentUser() user: RequestUser,
    @Param('examId') examId: string,
    @Body() dto: RescheduleExamDto,
  ) {
    return this.examService.rescheduleExam(user.id, examId, dto.scheduledAt);
  }

  @Post('exam/:examId/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start an exam session',
    description:
      'Sets the exam to IN_PROGRESS and returns the randomized exam questions without correct answers. The exam must be started within the allowed time window from the scheduled time.',
  })
  @ApiParam({ name: 'examId', description: 'Exam ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({
    status: 200,
    description: 'Exam started. Returns exam questions without correct answers.',
  })
  @ApiResponse({
    status: 400,
    description: 'Exam cannot be started (wrong status or outside time window).',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({
    status: 404,
    description: 'Exam not found or does not belong to this candidate.',
  })
  async startExam(
    @CurrentUser() user: RequestUser,
    @Param('examId') examId: string,
  ) {
    return this.examService.startExam(user.id, examId);
  }

  @Post('exam/:examId/answer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Auto-save a single answer during an exam',
    description:
      'Saves or overwrites the answer for a specific question. Call this after each answer to prevent data loss. Empty answerIds means the question is left unanswered. Set flagged: true to mark a question for review.',
  })
  @ApiParam({ name: 'examId', description: 'Exam ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({ status: 200, description: 'Answer saved.' })
  @ApiResponse({ status: 400, description: 'Exam is not IN_PROGRESS.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'Exam or question not found.' })
  async submitExamAnswer(
    @CurrentUser() user: RequestUser,
    @Param('examId') examId: string,
    @Body() dto: SaveAnswerDto,
  ) {
    return this.examService.saveAnswer(user.id, examId, dto);
  }

  @Post('exam/:examId/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit the exam for grading',
    description:
      'Finalizes the exam and enqueues it for async grading. Status is set to SUBMITTED. Poll GET /exam/:examId/results to retrieve the grade once processing is complete.',
  })
  @ApiParam({ name: 'examId', description: 'Exam ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({
    status: 200,
    description: 'Exam submitted for grading. Status set to SUBMITTED.',
  })
  @ApiResponse({ status: 400, description: 'Exam is not IN_PROGRESS.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({
    status: 404,
    description: 'Exam not found or does not belong to this candidate.',
  })
  async submitExam(
    @CurrentUser() user: RequestUser,
    @Param('examId') examId: string,
    @Body() dto: SubmitExamDto,
  ) {
    return this.examService.submitExam(user.id, examId, dto);
  }

  // NOTE: exam/history must be defined before exam/:examId/results to prevent
  // "history" being captured as the :examId parameter.
  @Get('exam/history')
  @ApiOperation({
    summary: 'Get exam attempt history',
    description:
      'Returns all past exam sessions for the authenticated candidate, including score and status for each attempt.',
  })
  @ApiResponse({ status: 200, description: 'Exam history returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async getExamHistory(@CurrentUser() user: RequestUser) {
    return this.examService.getExamHistory(user.id);
  }

  @Get('exam/:examId/results')
  @ApiOperation({
    summary: 'Get exam results',
    description:
      'Returns the graded results including score, pass/fail, time taken, and per-question correct answer breakdown. Only available after grading is complete (status PASSED or FAILED).',
  })
  @ApiParam({ name: 'examId', description: 'Exam ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({
    status: 200,
    description: 'Returns exam score, pass/fail, and answer breakdown.',
  })
  @ApiResponse({
    status: 400,
    description: 'Grading not yet complete (status still SUBMITTED).',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({
    status: 404,
    description: 'Exam not found or does not belong to this candidate.',
  })
  async getExamResults(
    @CurrentUser() user: RequestUser,
    @Param('examId') examId: string,
  ) {
    return this.examService.getExamResult(user.id, examId);
  }

  @Get('certificate/me')
  @ApiOperation({
    summary: 'Get my KCA certificate',
    description:
      'Returns the KCA certificate details including KCA number, issue date, expiry date, and PDF URL if available.',
  })
  @ApiResponse({ status: 200, description: 'Certificate returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({
    status: 404,
    description: 'No certificate has been issued yet for this candidate.',
  })
  async getMyCertificate(@CurrentUser() user: RequestUser) {
    return this.certificateService.findByUserId(user.id);
  }
}
