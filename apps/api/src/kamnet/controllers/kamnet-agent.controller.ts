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
  CurrentUser,
  PaginationQueryDto,
  RequestUser,
  RoleCode,
  Roles,
} from '@kambriq/common';
import {
  SubmitApplicationDto,
  UpdateAgentProfileDto,
  CreateLeadDto,
  UpdateLeadDto,
  LeadFilterDto,
  CommissionFilterDto,
  NetworkTreeQueryDto,
} from '../dto/kamnet.dto';
import { KamnetApplicationsService } from '../applications/applications.service';
import { KamnetAgentsService } from '../agents/agents.service';
import { KamnetLeadsService } from '../leads/leads.service';
import { KamnetCommissionsService } from '../commissions/commissions.service';
import { KamnetNetworkService } from '../network/network.service';

@ApiTags('KAMNET - Agent')
@ApiBearerAuth()
@Controller('kamnet')
export class KamnetAgentController {
  constructor(
    private readonly applicationsService: KamnetApplicationsService,
    private readonly agentsService: KamnetAgentsService,
    private readonly leadsService: KamnetLeadsService,
    private readonly commissionsService: KamnetCommissionsService,
    private readonly networkService: KamnetNetworkService,
  ) {}

  @Post('applications')
  @Roles(RoleCode.KCA_CERTIFIED)
  @ApiOperation({
    summary: 'Submit KAMNET application',
    description:
      'KCA-certified users submit an application to join KAMNET. Requires a valid KCA certificate number.',
  })
  @ApiResponse({ status: 201, description: 'Application submitted.' })
  @ApiResponse({
    status: 403,
    description: 'Invalid or expired KCA certificate.',
  })
  @ApiResponse({ status: 409, description: 'Application already exists.' })
  async submitApplication(
    @CurrentUser() user: RequestUser,
    @Body() dto: SubmitApplicationDto,
  ) {
    return this.applicationsService.submit(user.id, dto);
  }

  @Get('applications/me')
  @Roles(RoleCode.KCA_CERTIFIED)
  @ApiOperation({ summary: 'Get my KAMNET application status' })
  @ApiResponse({ status: 200, description: 'Application details returned.' })
  @ApiResponse({ status: 404, description: 'No application found.' })
  async getMyApplication(@CurrentUser() user: RequestUser) {
    return this.applicationsService.getMyApplication(user.id);
  }

  @Get('agents/me')
  @Roles(RoleCode.AGENT)
  @ApiOperation({
    summary: 'Get my agent profile',
    description:
      'Returns agent profile enriched with Core user info (name, email, phone).',
  })
  @ApiResponse({ status: 200, description: 'Agent profile returned.' })
  @ApiResponse({ status: 404, description: 'Agent profile not found.' })
  async getMyAgentProfile(@CurrentUser() user: RequestUser) {
    return this.agentsService.getMyProfile(user.id);
  }

  @Patch('agents/me')
  @Roles(RoleCode.AGENT)
  @ApiOperation({ summary: 'Update my agent profile (bio, country, city)' })
  @ApiResponse({ status: 200, description: 'Profile updated.' })
  async updateMyProfile(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateAgentProfileDto,
  ) {
    return this.agentsService.updateMyProfile(user.id, dto);
  }

  @Get('agents/:id')
  @Roles(RoleCode.AGENT)
  @ApiOperation({ summary: "Get another agent's public profile" })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  @ApiResponse({ status: 200, description: 'Agent profile returned.' })
  @ApiResponse({ status: 404, description: 'Agent not found.' })
  async getAgentProfile(@Param('id') id: string) {
    return this.agentsService.findById(id);
  }

  @Post('leads')
  @Roles(RoleCode.AGENT)
  @ApiOperation({ summary: 'Create a new lead/prospect' })
  @ApiResponse({ status: 201, description: 'Lead created.' })
  async createLead(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateLeadDto,
  ) {
    const agent = await this.agentsService.findByUserId(user.id);
    return this.leadsService.create(agent.id, dto);
  }

  @Get('leads')
  @Roles(RoleCode.AGENT)
  @ApiOperation({ summary: 'List my leads' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'], description: 'Filter by lead status' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by client name or email' })
  async getMyLeads(
    @CurrentUser() user: RequestUser,
    @Query() pagination: PaginationQueryDto,
    @Query() filters: LeadFilterDto,
  ) {
    const agent = await this.agentsService.findByUserId(user.id);
    return this.leadsService.findMyLeads(agent.id, pagination, filters);
  }

  @Get('leads/:id')
  @Roles(RoleCode.AGENT)
  @ApiOperation({ summary: 'Get a specific lead' })
  @ApiParam({ name: 'id', description: 'Lead ID' })
  async getLead(@CurrentUser() user: RequestUser, @Param('id') leadId: string) {
    const agent = await this.agentsService.findByUserId(user.id);
    return this.leadsService.findOne(leadId, agent.id);
  }

  @Patch('leads/:id')
  @Roles(RoleCode.AGENT)
  @ApiOperation({ summary: 'Update a lead (status, notes, contact info)' })
  @ApiParam({ name: 'id', description: 'Lead ID' })
  async updateLead(
    @CurrentUser() user: RequestUser,
    @Param('id') leadId: string,
    @Body() dto: UpdateLeadDto,
  ) {
    const agent = await this.agentsService.findByUserId(user.id);
    return this.leadsService.update(leadId, agent.id, dto);
  }

  @Delete('leads/:id')
  @Roles(RoleCode.AGENT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a lead' })
  @ApiParam({ name: 'id', description: 'Lead ID' })
  async deleteLead(
    @CurrentUser() user: RequestUser,
    @Param('id') leadId: string,
  ) {
    const agent = await this.agentsService.findByUserId(user.id);
    return this.leadsService.delete(leadId, agent.id);
  }

  /**
   * I16 - the two commission routes are read by ownership, not by role.
   *
   * They required AGENT, so suspending an agent - which now removes AGENT -
   * would have hidden the commissions they earned. The data belongs to the
   * KamnetAgent record, not to the agent's status: `findByUserId` resolves the
   * caller's own record (404 for anybody without one) and the query is scoped to
   * it. No role is needed and none is added.
   */
  @Get('commissions')
  @ApiOperation({ summary: 'List my commission records' })
  @ApiResponse({ status: 404, description: 'The caller has no KAMNET agent record.' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'VALIDATED', 'PAID'], description: 'Filter by commission status' })
  async getMyCommissions(
    @CurrentUser() user: RequestUser,
    @Query() pagination: PaginationQueryDto,
    @Query() filters: CommissionFilterDto,
  ) {
    const agent = await this.agentsService.findByUserId(user.id);
    return this.commissionsService.findMyCommissions(
      agent.id,
      pagination,
      filters,
    );
  }

  @Get('commissions/summary')
  // Ownership, not role - see `getMyCommissions` (I16).
  @ApiResponse({ status: 404, description: 'The caller has no KAMNET agent record.' })
  @ApiOperation({
    summary: 'Get my commission summary',
    description: 'Aggregate totals: pending, validated, and paid commissions.',
  })
  async getCommissionSummary(@CurrentUser() user: RequestUser) {
    const agent = await this.agentsService.findByUserId(user.id);
    return this.commissionsService.getSummary(agent.id);
  }

  @Get('network')
  @Roles(RoleCode.AGENT)
  @ApiOperation({
    summary: 'Get my sponsorship network',
    description: 'Returns referrals up to N3 depth. Use ?depth=1|2|3.',
  })
  @ApiQuery({ name: 'depth', required: false, type: Number, enum: [1, 2, 3], description: 'Tree depth: 1=N1 only, 2=N1+N2, 3=N1+N2+N3. Defaults to 1.' })
  async getMyNetwork(
    @CurrentUser() user: RequestUser,
    @Query() query: NetworkTreeQueryDto,
  ) {
    return this.networkService.getMyNetwork(user.id, query.depth);
  }

  @Get('network/sponsors')
  @Roles(RoleCode.AGENT)
  @ApiOperation({
    summary: 'Get my sponsor chain',
    description:
      'Walk up the tree: who sponsored me, who sponsored them, up to N3.',
  })
  async getMySponsorChain(@CurrentUser() user: RequestUser) {
    return this.networkService.getMySponsorChain(user.id);
  }
}
