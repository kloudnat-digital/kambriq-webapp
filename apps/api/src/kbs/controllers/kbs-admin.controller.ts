import {
  CurrentUser,
  ExamStatus,
  PaginationQueryDto,
  RequestUser,
  RoleCode,
  Roles,
} from '@kambriq/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { KbsCoursesService } from '../courses/courses.service';
import { KbsCandidatesService } from '../candidates/candidates.service';
import { KbsExamService } from '../exam/exam.service';
import { KbsCertificatesService } from '../certificates/certificates.service';
import {
  CreateCourseDto,
  CreateLessonDto,
  CreateModuleDto,
  CreateQuestionDto,
  GetUploadUrlDto,
  ReorderModulesDto,
  UpdateCourseDto,
  UpdateLessonDto,
  UpdateModuleDto,
  UpdateQuestionDto,
} from '../courses/dto/course.dto';
import { CancelExamDto, CreateExamQuestionDto, UpdateExamQuestionDto } from '../exam/dto/exam.dto';
import { CandidateFilterDto, UpdateCandidateStatusDto } from '../candidates/dto/candidate.dto';
import { IssueCertificateDto, RevokeCertificateDto } from '../certificates/dto/certificate.dto';
import { KbsSettingsService } from '../settings/settings.service';
import { UpdateSettingsDto } from '../settings/dto/settings.dto';

@ApiTags('KBS - Admin')
@ApiBearerAuth()
@Roles(RoleCode.ADMIN_KBS, RoleCode.ADMIN_GLOBAL)
@Controller('kbs/admin')
export class KbsAdminController {
  constructor(
    private readonly coursesService: KbsCoursesService,
    private readonly candidatesService: KbsCandidatesService,
    private readonly examService: KbsExamService,
    private readonly certificatesService: KbsCertificatesService,
    private readonly settingsService: KbsSettingsService,
  ) {}

  // ─── Courses ───────────────────────────────────────────────────────────────

  @Post('courses')
  @ApiOperation({
    summary: 'Create a new course',
    description:
      'Creates a KBS training course. Start with isPublished: false (draft) and publish when the content is ready.',
  })
  @ApiResponse({ status: 201, description: 'Course created successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions. Requires ADMIN_KBS or ADMIN_GLOBAL.',
  })
  async createCourse(@Body() dto: CreateCourseDto) {
    return this.coursesService.createCourse(dto);
  }

  @Get('courses')
  @ApiOperation({
    summary: 'List all courses',
    description: 'Returns every KBS course with basic module information for admin selection UIs.',
  })
  @ApiResponse({ status: 200, description: 'Courses returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  async listCourses() {
    return this.coursesService.findAllCourses();
  }

  @Get('courses/:id')
  @ApiOperation({
    summary: 'Get course detail',
    description: 'Returns the full course with all modules, lessons, and quiz question counts.',
  })
  @ApiParam({
    name: 'id',
    description: 'Course ID (CUID)',
    example: 'clxxxxxxxxxxxxxx',
  })
  @ApiResponse({ status: 200, description: 'Course found and returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Course not found.' })
  async getCourseDetail(@Param('id') id: string) {
    return this.coursesService.findCourseById(id);
  }

  @Patch('courses/:id')
  @ApiOperation({
    summary: 'Update a course',
    description:
      'Partially updates course fields. Set isPublished: true to make the course visible to candidates.',
  })
  @ApiParam({
    name: 'id',
    description: 'Course ID (CUID)',
    example: 'clxxxxxxxxxxxxxx',
  })
  @ApiResponse({ status: 200, description: 'Course updated.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Course not found.' })
  async updateCourse(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.updateCourse(id, dto);
  }

  @Delete('courses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a course',
    description:
      'Permanently deletes the course and cascades to all associated modules, lessons, questions, and answers.',
  })
  @ApiParam({
    name: 'id',
    description: 'Course ID (CUID)',
    example: 'clxxxxxxxxxxxxxx',
  })
  @ApiResponse({
    status: 204,
    description: 'Course and all its content deleted.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Course not found.' })
  async deleteCourse(@Param('id') id: string) {
    return this.coursesService.deleteCourse(id);
  }

  @Post('modules')
  @ApiOperation({
    summary: 'Create a module within a course',
    description:
      'Adds a new module to an existing course. Modules are displayed in ascending order by the `order` field.',
  })
  @ApiResponse({ status: 201, description: 'Module created.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Parent course not found.' })
  async createModule(@Body() dto: CreateModuleDto) {
    return this.coursesService.createModule(dto);
  }

  @Patch('modules/reorder')
  @ApiOperation({
    summary: 'Reorder modules within a course',
    description:
      'Sets the display order of modules in a course by providing the complete ordered array of module IDs.',
  })
  @ApiResponse({ status: 200, description: 'Module order updated.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Course or module not found.' })
  async reorderModules(@Body() dto: ReorderModulesDto) {
    return this.coursesService.reorderModules(dto);
  }

  @Patch('modules/:id')
  @ApiOperation({
    summary: 'Update a module',
    description: 'Partially updates module fields (title, description, order).',
  })
  @ApiParam({
    name: 'id',
    description: 'Module ID (CUID)',
    example: 'clxxxxxxxxxxxxxx',
  })
  @ApiResponse({ status: 200, description: 'Module updated.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Module not found.' })
  async updateModule(@Param('id') id: string, @Body() dto: UpdateModuleDto) {
    return this.coursesService.updateModule(id, dto);
  }

  @Delete('modules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a module',
    description:
      'Permanently deletes the module and cascades to all lessons, questions, and answers within it.',
  })
  @ApiParam({
    name: 'id',
    description: 'Module ID (CUID)',
    example: 'clxxxxxxxxxxxxxx',
  })
  @ApiResponse({
    status: 204,
    description: 'Module and all its content deleted.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Module not found.' })
  async deleteModule(@Param('id') id: string) {
    return this.coursesService.deleteModule(id);
  }

  @Post('lessons')
  @ApiOperation({
    summary: 'Create a lesson within a module',
    description:
      'Adds a lesson to a module. Supported content types: VIDEO, PDF, HTML, TEXT. Use POST /upload-url first to obtain the S3 key, then pass it as contentUrl.',
  })
  @ApiResponse({ status: 201, description: 'Lesson created.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Parent module not found.' })
  async createLesson(@Body() dto: CreateLessonDto) {
    return this.coursesService.createLesson(dto);
  }

  @Patch('lessons/:id')
  @ApiOperation({
    summary: 'Update a lesson',
    description:
      'Partially updates lesson fields (title, contentType, contentUrl, duration, order).',
  })
  @ApiParam({
    name: 'id',
    description: 'Lesson ID (CUID)',
    example: 'clxxxxxxxxxxxxxx',
  })
  @ApiResponse({ status: 200, description: 'Lesson updated.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Lesson not found.' })
  async updateLesson(@Param('id') id: string, @Body() dto: UpdateLessonDto) {
    return this.coursesService.updateLesson(id, dto);
  }

  @Delete('lessons/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a lesson',
    description: 'Permanently deletes the lesson.',
  })
  @ApiParam({
    name: 'id',
    description: 'Lesson ID (CUID)',
    example: 'clxxxxxxxxxxxxxx',
  })
  @ApiResponse({ status: 204, description: 'Lesson deleted.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Lesson not found.' })
  async deleteLesson(@Param('id') id: string) {
    return this.coursesService.deleteLesson(id);
  }

  @Get('modules/:moduleId/questions')
  @ApiOperation({
    summary: 'List quiz questions for a module (with correct answers)',
    description:
      'Returns all quiz questions for a module including correct answer indicators. For the candidate-facing quiz (without answers), use GET /kbs/modules/:moduleId/quiz.',
  })
  @ApiParam({
    name: 'moduleId',
    description: 'Module ID (CUID)',
    example: 'clxxxxxxxxxxxxxx',
  })
  @ApiResponse({
    status: 200,
    description: 'Questions returned with correct answer information.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Module not found.' })
  async getQuestions(@Param('moduleId') moduleId: string) {
    return this.coursesService.findQuestionsAdmin(moduleId);
  }

  @Post('questions')
  @ApiOperation({
    summary: 'Create a quiz question with answers',
    description:
      "Adds a question to a module's quiz pool. SINGLE type expects exactly one correct answer; MULTIPLE expects one or more. At least one answer must be marked correct.",
  })
  @ApiResponse({ status: 201, description: 'Question created with answers.' })
  @ApiResponse({
    status: 400,
    description: 'Validation error (e.g., no correct answer marked).',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Parent module not found.' })
  async createQuestion(@Body() dto: CreateQuestionDto) {
    return this.coursesService.createQuestion(dto);
  }

  @Patch('questions/:id')
  @ApiOperation({
    summary: 'Update a quiz question',
    description:
      "Updates a question's text, type, or answers. If answers are provided, the existing answer set is fully replaced.",
  })
  @ApiParam({
    name: 'id',
    description: 'Question ID (CUID)',
    example: 'clxxxxxxxxxxxxxx',
  })
  @ApiResponse({ status: 200, description: 'Question updated.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Question not found.' })
  async updateQuestion(@Param('id') id: string, @Body() dto: UpdateQuestionDto) {
    return this.coursesService.updateQuestion(id, dto);
  }

  @Delete('questions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a quiz question',
    description: 'Permanently removes the question and all its answers from the module quiz pool.',
  })
  @ApiParam({
    name: 'id',
    description: 'Question ID (CUID)',
    example: 'clxxxxxxxxxxxxxx',
  })
  @ApiResponse({ status: 204, description: 'Question deleted.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Question not found.' })
  async deleteQuestion(@Param('id') id: string) {
    return this.coursesService.deleteQuestion(id);
  }

  @Get('exam-questions')
  @ApiOperation({
    summary: 'List all exam pool questions (with correct answers)',
    description:
      'Returns all questions in the dedicated final exam pool. These are different from module quiz questions and are randomly sampled for each exam session.',
  })
  @ApiResponse({
    status: 200,
    description: 'Exam pool questions returned with correct answers.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  async listExamQuestions() {
    return this.examService.findAllExamQuestions();
  }

  @Post('exam-questions')
  @ApiOperation({
    summary: 'Add a question to the final exam pool',
    description:
      'Creates a dedicated exam pool question. A minimum pool size is required before exams can be scheduled by candidates.',
  })
  @ApiResponse({ status: 201, description: 'Exam question created.' })
  @ApiResponse({
    status: 400,
    description: 'Validation error (e.g., no correct answer marked).',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  async createExamQuestion(@Body() dto: CreateExamQuestionDto) {
    return this.examService.createExamQuestion(dto);
  }

  @Patch('exam-questions/:id')
  @ApiOperation({
    summary: 'Update an exam pool question',
    description:
      'Partially updates an exam question. If answers are provided, the existing answer set is fully replaced.',
  })
  @ApiParam({
    name: 'id',
    description: 'Exam Question ID (CUID)',
    example: 'clxxxxxxxxxxxxxx',
  })
  @ApiResponse({ status: 200, description: 'Exam question updated.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Exam question not found.' })
  async updateExamQuestion(@Param('id') id: string, @Body() dto: UpdateExamQuestionDto) {
    return this.examService.updateExamQuestion(id, dto);
  }

  @Delete('exam-questions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove a question from the exam pool',
    description:
      'Permanently deletes an exam question. Ensure the pool retains enough questions for future exam sessions.',
  })
  @ApiParam({
    name: 'id',
    description: 'Exam Question ID (CUID)',
    example: 'clxxxxxxxxxxxxxx',
  })
  @ApiResponse({ status: 204, description: 'Exam question deleted.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Exam question not found.' })
  async deleteExamQuestion(@Param('id') id: string) {
    return this.examService.deleteExamQuestion(id);
  }

  @Post('upload-url')
  @ApiOperation({
    summary: 'Get a presigned S3 URL for lesson content upload',
    description:
      'Returns a short-lived presigned PUT URL for uploading lesson content (video, PDF, etc.) directly from the browser to S3. Use the returned fileUrl as the lesson contentUrl.',
  })
  @ApiResponse({
    status: 201,
    description: 'Returns { uploadUrl: presigned PUT URL, fileUrl: permanent asset URL }.',
  })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  async getUploadUrl(@Body() dto: GetUploadUrlDto) {
    return this.coursesService.getUploadUrl(dto);
  }

  @Get('candidates')
  @ApiOperation({
    summary: 'List all candidates',
    description:
      'Returns a paginated list of KBS candidates. Filter by status or search by name/email.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by candidate status',
    enum: ['CANDIDATE', 'IN_TRAINING', 'EXAM_PENDING', 'CERTIFIED', 'FAILED'],
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by candidate name or email',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated candidate list returned.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  async listCandidates(@Query() query: PaginationQueryDto, @Query() filter: CandidateFilterDto) {
    return this.candidatesService.findAll(query, filter.status, filter.search);
  }

  @Get('candidates/:id')
  @ApiOperation({
    summary: 'Get candidate detail',
    description:
      'Returns the full candidate profile including training progress, quiz results, exam history, and certificate information.',
  })
  @ApiParam({
    name: 'id',
    description: 'Candidate ID (CUID)',
    example: 'clxxxxxxxxxxxxxx',
  })
  @ApiResponse({ status: 200, description: 'Candidate detail returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Candidate not found.' })
  async getCandidate(@Param('id') id: string) {
    return this.candidatesService.findById(id);
  }

  @Patch('candidates/:id/status')
  @ApiOperation({
    summary: 'Update candidate status',
    description:
      'Manually transitions a candidate status. Only valid state machine transitions are accepted: CANDIDATE → IN_TRAINING → EXAM_PENDING → CERTIFIED | FAILED. FAILED → EXAM_PENDING is allowed for retakes.',
  })
  @ApiParam({
    name: 'id',
    description: 'Candidate ID (CUID)',
    example: 'clxxxxxxxxxxxxxx',
  })
  @ApiResponse({ status: 200, description: 'Candidate status updated.' })
  @ApiResponse({ status: 400, description: 'Invalid status transition.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Candidate not found.' })
  async updateCandidateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCandidateStatusDto,
    @CurrentUser() admin: RequestUser,
  ) {
    return this.candidatesService.updateStatus(id, admin.id, dto);
  }

  @Post('candidates/:id/reset-attempts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset exam attempts for a candidate',
    description:
      'Clears the exam attempt count, allowing the candidate to schedule a new exam session. Typically used after a FAILED outcome.',
  })
  @ApiParam({
    name: 'id',
    description: 'Candidate ID (CUID)',
    example: 'clxxxxxxxxxxxxxx',
  })
  @ApiResponse({
    status: 200,
    description: 'Attempts reset. Candidate can now schedule a new exam.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Candidate not found.' })
  async resetAttempts(@Param('id') candidateId: string) {
    return this.examService.resetAttempts(candidateId);
  }

  @Get('exams')
  @ApiOperation({
    summary: 'List all exam sessions',
    description:
      'Returns a paginated list of all exam sessions across all candidates. Filter by status to find exams requiring attention.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by exam status',
    enum: ['SCHEDULED', 'IN_PROGRESS', 'SUBMITTED', 'PASSED', 'FAILED', 'CANCELLED'],
  })
  @ApiResponse({ status: 200, description: 'Paginated exam list returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  async listExams(@Query() query: PaginationQueryDto, @Query('status') status?: string) {
    return this.examService.findAllExams({
      ...query,
      status: status as ExamStatus,
    });
  }

  @Patch('exams/:id/cancel')
  @ApiOperation({
    summary: 'Cancel a scheduled or in-progress exam',
    description:
      'Cancels an exam session with a mandatory reason. Only SCHEDULED or IN_PROGRESS exams can be cancelled.',
  })
  @ApiParam({
    name: 'id',
    description: 'Exam ID (CUID)',
    example: 'clxxxxxxxxxxxxxx',
  })
  @ApiResponse({ status: 200, description: 'Exam cancelled.' })
  @ApiResponse({
    status: 400,
    description: 'Exam is not in a cancellable state (SCHEDULED or IN_PROGRESS).',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Exam not found.' })
  async cancelExam(@Param('id') id: string, @Body() dto: CancelExamDto) {
    return this.examService.cancelExam(id, dto);
  }

  @Post('certificates/:candidateId')
  @ApiOperation({
    summary: 'Issue a KCA certificate to a candidate',
    description:
      'Manually issues a KCA certificate. The candidate must have CERTIFIED status or a passing exam. Generates a unique KCA number valid for 2 years, grants the KCA_CERTIFIED role, and sends a confirmation email.',
  })
  @ApiParam({
    name: 'candidateId',
    description: 'Candidate ID (CUID)',
    example: 'clxxxxxxxxxxxxxx',
  })
  @ApiResponse({
    status: 201,
    description: 'Certificate issued. Returns the certificate with the KCA number.',
  })
  @ApiResponse({
    status: 400,
    description: 'Candidate has not met the certification requirements.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Candidate not found.' })
  @ApiResponse({
    status: 409,
    description: 'A certificate already exists for this candidate.',
  })
  async issueCertificate(
    @Param('candidateId') candidateId: string,
    @CurrentUser() admin: RequestUser,
    @Body() dto: IssueCertificateDto,
  ) {
    return this.certificatesService.issueCertificate(candidateId, admin.id, dto);
  }

  @Patch('certificates/:candidateId/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke a KCA certificate',
    description:
      'Marks a certificate as revoked with a mandatory reason. Removes the KCA_CERTIFIED role from the user and resets the candidate status to EXAM_PENDING.',
  })
  @ApiParam({ name: 'candidateId', description: 'Candidate ID (CUID)' })
  @ApiResponse({ status: 200, description: 'Certificate revoked.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({
    status: 404,
    description: 'Candidate or certificate not found.',
  })
  @ApiResponse({ status: 409, description: 'Certificate already revoked.' })
  async revokeCertificate(
    @Param('candidateId') candidateId: string,
    @CurrentUser() admin: RequestUser,
    @Body() dto: RevokeCertificateDto,
  ) {
    return this.certificatesService.revokeCertificate(candidateId, admin.id, dto);
  }

  @Get('certificates')
  @ApiOperation({
    summary: 'List all issued KCA certificates',
    description:
      'Returns a paginated list of all issued KCA certificates, sorted by issuance date.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated certificate list returned.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  async listCertificates(@Query() query: PaginationQueryDto) {
    return this.certificatesService.findAll(query);
  }

  @Get('settings')
  @ApiOperation({
    summary: 'Get the KBS settings singleton',
    description:
      'Returns the singleton settings row (active course, question counts, quiz attempts and cooldown). Auto-creates a default row on first call if none exists.',
  })
  @ApiResponse({ status: 200, description: 'Settings returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch('settings')
  @ApiOperation({
    summary: 'Update the KBS settings singleton',
    description:
      'Partial update of the settings row. Only the provided fields are applied. If `activeCourseId` is provided, it must reference an existing course.',
  })
  @ApiResponse({ status: 200, description: 'Settings updated.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  @ApiResponse({ status: 404, description: 'Referenced course not found.' })
  async updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }
}
