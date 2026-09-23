import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { KbsCoursesService } from '../courses/courses.service';
import { KbsCandidatesService } from '../candidates/candidates.service';
import { KbsExamService } from '../exam/exam.service';
import { KbsCertificatesService } from '../certificates/certificates.service';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, RequestUser, RoleCode, Roles } from '@kambriq/common';
import { CvUploadUrlDto, EnrollDto, SubmitQuizDto } from '../candidates/dto/candidate.dto';
import { RescheduleExamDto, SaveAnswerDto, SubmitExamDto } from '../exam/dto/exam.dto';

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

  // No role is required here because this route grants the CANDIDATE_KBS role.
  // Adding a role requirement would prevent new candidates from enrolling.
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
  @ApiResponse({
    status: 400,
    description: 'No identity document on file, or the engagement was not accepted.',
  })
  @ApiResponse({ status: 409, description: 'User is already enrolled in KBS.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async enroll(@CurrentUser() user: RequestUser, @Body() dto: EnrollDto) {
    return this.candidatesService.enroll(user.id, dto);
  }

  // No role is required here because the CV is uploaded before enrollment,
  // preceding the grant of the CANDIDATE_KBS role.
  @Post('cv/upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a presigned S3 URL for CV upload',
    description:
      'Returns { uploadUrl, fileUrl }. Upload the file directly to uploadUrl, then send the fileUrl in the `cvUrl` field of POST /kbs/enroll.',
  })
  @ApiResponse({ status: 200, description: 'Presigned upload URL returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async getCvUploadUrl(@CurrentUser() user: RequestUser, @Body() dto: CvUploadUrlDto) {
    return this.candidatesService.getCvUploadUrl(user.id, dto);
  }

  // No role is required here to allow non-enrolled users to check their status.
  // A 403 response would disrupt the frontend's handling of the 404 enrollment check.
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

  @Get('me/overview')
  @Roles(RoleCode.CANDIDATE_KBS)
  @ApiOperation({
    summary: 'Get my full KBS training path (aggregated dashboard view)',
    description:
      "Single-call view for the candidate dashboard: candidate profile, active course, per-module status (locked/in_progress/completed), quiz state, overall completion percentage, and the recommended next action ('lesson' | 'mcq' | 'exam' | 'certified').",
  })
  @ApiResponse({ status: 200, description: 'Parcours returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({
    status: 404,
    description: 'User is not enrolled in KBS, or active course is missing.',
  })
  async getMyParcours(@CurrentUser() user: RequestUser) {
    return this.candidatesService.getMyOverview(user.id);
  }

  @Get('courses')
  @Roles(RoleCode.CANDIDATE_KBS)
  @ApiOperation({
    summary: 'List all published courses',
    description: 'Returns all KBS courses that are published and available to candidates.',
  })
  @ApiResponse({ status: 200, description: 'Published courses returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async listCourses() {
    return this.coursesService.findPublishedCourses();
  }

  @Get('courses/:courseId/modules')
  @Roles(RoleCode.CANDIDATE_KBS)
  @ApiOperation({
    summary: 'Get modules for a course with personal progress',
    description:
      'Returns all modules for a course. If the user is enrolled in KBS, each module includes their quiz completion status and score.',
  })
  @ApiParam({ name: 'courseId', description: 'Course ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({
    status: 200,
    description: 'Module list returned, with progress indicators for enrolled candidates.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'Course not found, or not published.' })
  async getCourseModules(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    await this.coursesService.findCandidateCourseOrThrow(courseId);
    const candidate = await this.candidatesService.findByUserId(user.id);
    if (!candidate) {
      return this.coursesService.findModulesByCourseId(courseId);
    }
    return this.coursesService.findModulesWithProgress(courseId, candidate.id);
  }

  @Get('lesson/:lessonId')
  @Roles(RoleCode.CANDIDATE_KBS)
  @ApiOperation({
    summary: 'Get lesson content',
    description: 'Returns the full lesson including content URL (video, PDF, etc.) and metadata.',
  })
  @ApiParam({ name: 'lessonId', description: 'Lesson ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({ status: 200, description: 'Lesson content returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Enrolled, but the enrolment is not verified yet.' })
  @ApiResponse({
    status: 404,
    description: 'Not enrolled in KBS, or lesson not found, or its course is not published.',
  })
  async getLessonContent(@CurrentUser() user: RequestUser, @Param('lessonId') lessonId: string) {
    return this.coursesService.findLessonById(lessonId, user.id);
  }

  @Get('lessons/:lessonId/view')
  @Roles(RoleCode.CANDIDATE_KBS)
  @ApiOperation({
    summary: 'Get lesson viewer payload (aggregated)',
    description:
      'Single-call view for the lesson screen: lesson metadata, module info, signed content URL (for video/pdf) OR inline content (for html/text), completion timestamp for the candidate, and prev/next navigation refs.',
  })
  @ApiParam({ name: 'lessonId', description: 'Lesson ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({ status: 200, description: 'Lesson view returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'Lesson not found.' })
  async getLessonView(@CurrentUser() user: RequestUser, @Param('lessonId') lessonId: string) {
    return this.coursesService.findLessonView(lessonId, user.id);
  }

  @Get('modules/:moduleId/detail')
  @Roles(RoleCode.CANDIDATE_KBS)
  @ApiOperation({
    summary: 'Get module detail (aggregated view for module viewer)',
    description:
      'Single-call view for the module screen: module info, ordered lessons with per-lesson completion for the candidate, and quiz state (unlocked, attempts, score, passed, next attempt time in cooldown).',
  })
  @ApiParam({ name: 'moduleId', description: 'Module ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({ status: 200, description: 'Module detail returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'Module not found.' })
  async getModuleDetail(@CurrentUser() user: RequestUser, @Param('moduleId') moduleId: string) {
    return this.coursesService.findModuleDetail(moduleId, user.id);
  }

  @Post('lesson/:lessonId/complete')
  @Roles(RoleCode.CANDIDATE_KBS)
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
  async markLessonComplete(@CurrentUser() user: RequestUser, @Param('lessonId') lessonId: string) {
    return this.coursesService.markLessonComplete(user.id, lessonId);
  }

  @Get('modules/:moduleId/quiz')
  @Roles(RoleCode.CANDIDATE_KBS)
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
  async getModuleQuiz(@CurrentUser() user: RequestUser, @Param('moduleId') moduleId: string) {
    return this.coursesService.findQuestionsForQuiz(moduleId, user.id);
  }

  @Post('modules/:moduleId/quiz')
  @Roles(RoleCode.CANDIDATE_KBS)
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
  @Roles(RoleCode.CANDIDATE_KBS)
  @ApiOperation({
    summary: 'Check final exam eligibility',
    description:
      'Returns whether the candidate can schedule the final exam. If not eligible, includes the list of modules still requiring completion.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns { eligible: boolean, reason?: string, requiredModules?: [] }.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'Candidate not enrolled in KBS.' })
  async checkExamEligibility(@CurrentUser() user: RequestUser) {
    return this.examService.checkEligibility(user.id);
  }

  @Post('exam/schedule')
  @Roles(RoleCode.CANDIDATE_KBS)
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
  @Roles(RoleCode.CANDIDATE_KBS)
  @ApiOperation({
    summary: 'Reschedule a scheduled exam',
    description:
      'Changes the scheduled time of an exam that has not yet started. The new date must be in the future.',
  })
  @ApiParam({ name: 'examId', description: 'Exam ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({ status: 200, description: 'Exam rescheduled.' })
  @ApiResponse({
    status: 400,
    description: 'New date must be in the future, or exam is not in SCHEDULED status.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'The exam belongs to another candidate.' })
  @ApiResponse({ status: 404, description: 'Exam not found.' })
  async rescheduleExam(
    @CurrentUser() user: RequestUser,
    @Param('examId') examId: string,
    @Body() dto: RescheduleExamDto,
  ) {
    return this.examService.rescheduleExam(user.id, examId, dto.scheduledAt);
  }

  @Post('exam/:examId/start')
  @Roles(RoleCode.CANDIDATE_KBS)
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
  @ApiResponse({ status: 403, description: 'The exam belongs to another candidate.' })
  @ApiResponse({ status: 404, description: 'Exam not found.' })
  async startExam(@CurrentUser() user: RequestUser, @Param('examId') examId: string) {
    return this.examService.startExam(user.id, examId);
  }

  @Post('exam/:examId/answer')
  @Roles(RoleCode.CANDIDATE_KBS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Auto-save a single answer during an exam',
    description:
      'Saves or overwrites the answer for a specific question. Call this after each answer to prevent data loss. Empty answerIds means the question is left unanswered. Set flagged: true to mark a question for review.',
  })
  @ApiParam({ name: 'examId', description: 'Exam ID (CUID)', example: 'clxxxxxxxxxxxxxx' })
  @ApiResponse({ status: 200, description: 'Answer saved.' })
  @ApiResponse({
    status: 400,
    description:
      'Exam is not IN_PROGRESS or has expired, the question was not served in this exam, or an answer does not belong to the question.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'The exam belongs to another candidate.' })
  @ApiResponse({ status: 404, description: 'Exam not found.' })
  async submitExamAnswer(
    @CurrentUser() user: RequestUser,
    @Param('examId') examId: string,
    @Body() dto: SaveAnswerDto,
  ) {
    return this.examService.saveAnswer(user.id, examId, dto);
  }

  @Post('exam/:examId/submit')
  @Roles(RoleCode.CANDIDATE_KBS)
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
  @ApiResponse({
    status: 400,
    description:
      'Exam is not IN_PROGRESS; or it is past its deadline, in which case it is closed and graded on the answers saved in time; or an answer is on a question this exam did not serve (nothing is written).',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'The exam belongs to another candidate.' })
  @ApiResponse({ status: 404, description: 'Exam not found.' })
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
  @Roles(RoleCode.CANDIDATE_KBS)
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
  @Roles(RoleCode.CANDIDATE_KBS)
  @ApiOperation({
    summary: 'Get exam results',
    description:
      'Returns the graded results including score, pass/fail, time taken, and a per-module breakdown (correct, total, percentage). Never the correct answers: the question pool is reused across attempts and candidates. Only available after grading is complete (status PASSED or FAILED).',
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
  @ApiResponse({ status: 403, description: 'The exam belongs to another candidate.' })
  @ApiResponse({ status: 404, description: 'Exam not found.' })
  async getExamResults(@CurrentUser() user: RequestUser, @Param('examId') examId: string) {
    return this.examService.getExamResult(user.id, examId);
  }

  // No role is required here to allow non-enrolled users to check their certificate status.
  // A 403 response would disrupt the frontend's handling of missing certificates.
  @Get('certificate/me')
  @ApiOperation({
    summary: 'Get my KCA certificate',
    description:
      'Returns the KCA certificate details including KCA number, issue date, expiry date, and PDF URL if available.',
  })
  @ApiResponse({
    status: 200,
    description: 'Certificate returned, or `data: null` when none has been issued yet.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 404, description: 'The user is not enrolled in KBS.' })
  async getMyCertificate(@CurrentUser() user: RequestUser) {
    return this.certificateService.findByUserId(user.id);
  }
}
