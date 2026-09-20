import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, PaginationQueryDto, RequestUser, RoleCode, Roles } from '@kambriq/common';

import {
  ReviewApplicationDto,
  ApplicationFilterDto,
  AgentFilterDto,
  UpdateAgentStatusDto,
  CreateCommissionDto,
  UpdateCommissionStatusDto,
  CommissionFilterDto,
  AdminNetworkTreeQueryDto,
} from '../dto/kamnet.dto';
import { KamnetApplicationsService } from '../applications/applications.service';
import { KamnetAgentsService } from '../agents/agents.service';
import { KamnetCommissionsService } from '../commissions/commissions.service';
import { KamnetNetworkService } from '../network/network.service';

@ApiTags('KAMNET - Admin')
@ApiBearerAuth()
@Controller('kamnet/admin')
@Roles(RoleCode.ADMIN_KAMNET, RoleCode.ADMIN_GLOBAL)
export class KamnetAdminController {
  constructor(
    private readonly applicationsService: KamnetApplicationsService,
    private readonly agentsService: KamnetAgentsService,
    private readonly commissionsService: KamnetCommissionsService,
    private readonly networkService: KamnetNetworkService,
  ) {}

  @Get('applications')
  @ApiOperation({ summary: 'List all KAMNET applications' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    description: 'Filter by application status',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by applicant name or email',
  })
  async listApplications(
    @Query() pagination: PaginationQueryDto,
    @Query() filters: ApplicationFilterDto,
  ) {
    return this.applicationsService.findAll(pagination, filters);
  }

  @Post('applications/:id/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Review (approve/reject) a KAMNET application',
    description:
      'On approval: creates KamnetAgent record, assigns AGENT role, links sponsor. On rejection: notifies applicant.',
  })
  @ApiParam({ name: 'id', description: 'Application ID' })
  @ApiResponse({ status: 200, description: 'Application reviewed.' })
  @ApiResponse({
    status: 403,
    description: 'Application is not in pending status.',
  })
  @ApiResponse({ status: 404, description: 'Application not found.' })
  async reviewApplication(
    @CurrentUser() user: RequestUser,
    @Param('id') applicationId: string,
    @Body() dto: ReviewApplicationDto,
  ) {
    return this.applicationsService.review(applicationId, user.id, dto);
  }

  @Get('agents')
  @ApiOperation({ summary: 'List all agents with filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'tier',
    required: false,
    enum: ['JUNIOR', 'CONFIRMED', 'MANAGER'],
    description: 'Filter by agent tier',
  })
  @ApiQuery({ name: 'country', required: false, type: String, description: 'Filter by country' })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by agent code, name, or email',
  })
  async listAgents(@Query() pagination: PaginationQueryDto, @Query() filters: AgentFilterDto) {
    return this.agentsService.findAll(pagination, filters);
  }

  @Get('agents/:id')
  @ApiOperation({ summary: 'Get agent detail' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  async getAgent(@Param('id') id: string) {
    return this.agentsService.findById(id);
  }

  @Patch('agents/:id/status')
  @ApiOperation({
    summary: 'Update agent status',
    description: 'Manually set agent status (JUNIOR, CONFIRMED, MANAGER, SUSPENDED).',
  })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  async updateAgentStatus(@Param('id') id: string, @Body() dto: UpdateAgentStatusDto) {
    return this.agentsService.update(id, dto);
  }

  @Post('agents/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend an agent' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  async suspendAgent(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.agentsService.suspend(id, user.id);
  }

  @Post('agents/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a suspended agent' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  async reactivateAgent(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.agentsService.reactivate(id, user.id);
  }

  @Post('commissions')
  @ApiOperation({
    summary: 'Create a commission record',
    description:
      'Manually creates a commission entry for a completed sale. Since P9 sponsorship pays level 0 (the selling agent) and level 1 (their direct sponsor); 2 and 3 are still accepted by this endpoint but nothing produces them. Automated calculation is planned for v2.',
  })
  @ApiResponse({ status: 201, description: 'Commission record created.' })
  async createCommission(@Body() dto: CreateCommissionDto) {
    return this.commissionsService.create(dto);
  }

  @Get('commissions')
  @ApiOperation({ summary: 'List all commission records' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'VALIDATED', 'PAID'],
    description: 'Filter by commission status',
  })
  @ApiQuery({ name: 'agentId', required: false, type: String, description: 'Filter by agent ID' })
  async listCommissions(
    @Query() pagination: PaginationQueryDto,
    @Query() filters: CommissionFilterDto,
  ) {
    return this.commissionsService.findAll(pagination, filters);
  }

  @Patch('commissions/:id/status')
  @ApiOperation({
    summary: 'Update commission status (PENDING → VALIDATED → PAID)',
  })
  @ApiParam({ name: 'id', description: 'Commission ID' })
  async updateCommissionStatus(@Param('id') id: string, @Body() dto: UpdateCommissionStatusDto) {
    return this.commissionsService.updateStatus(id, dto);
  }

  @Get('network/tree')
  @ApiOperation({
    summary: 'View full sponsorship tree',
    description:
      'Returns the complete tree from a root agent or all root agents. Scoping by rootAgentId is strongly recommended for large networks.',
  })
  @ApiQuery({
    name: 'rootAgentId',
    required: false,
    type: String,
    description:
      'Scope tree to a specific root agent. Without this, returns up to 50 root agents at depth 1 (overview mode).',
  })
  @ApiQuery({
    name: 'depth',
    required: false,
    type: Number,
    enum: [1, 2, 3],
    description:
      'Tree depth (1-3). Only applies when rootAgentId is set; overview mode always uses depth 1.',
  })
  async getFullTree(@Query() query: AdminNetworkTreeQueryDto) {
    return this.networkService.getFullTree(query.rootAgentId, query.depth);
  }
}
