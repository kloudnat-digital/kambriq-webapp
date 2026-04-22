import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, PaginationQueryDto, RequestUser, RoleCode, Roles } from '@kambriq/common';
import { LandsService } from '../lands.service';
import { LandReservationsService } from '../reservations/reservations.service';
import {
  LandFilterDto,
  CreateLandReservationDto,
  CancelLandReservationDto,
  LandReservationFilterDto,
} from '../dto/lands.dto';

@ApiTags('LANDS - Agent')
@ApiBearerAuth()
@Controller('lands')
@Roles(RoleCode.AGENT)
export class LandsAgentController {
  constructor(
    private readonly landsService: LandsService,
    private readonly reservationsService: LandReservationsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Browse available land listings',
    description:
      'Returns published, available lands. Agents can filter by region, city, label, price range.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'region', required: false, type: String, description: 'Filter by region' })
  @ApiQuery({ name: 'city', required: false, type: String, description: 'Filter by city' })
  @ApiQuery({
    name: 'labelCode',
    required: false,
    enum: ['TFL', 'VEFL', 'VEFIL'],
    description: 'Filter by land classification',
  })
  @ApiQuery({
    name: 'minPrice',
    required: false,
    type: Number,
    description: 'Minimum price in XAF',
  })
  @ApiQuery({
    name: 'maxPrice',
    required: false,
    type: Number,
    description: 'Maximum price in XAF',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by title or description',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated land listings returned.',
  })
  async browseLands(@Query() pagination: PaginationQueryDto, @Query() filters: LandFilterDto) {
    return this.landsService.findForAgents(pagination, filters);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get land detail',
    description:
      'Full land detail with media (signed S3 URLs), label info, and recent reservations.',
  })
  @ApiParam({ name: 'id', description: 'Land ID' })
  @ApiResponse({ status: 200, description: 'Land detail returned.' })
  @ApiResponse({ status: 404, description: 'Land not found.' })
  async getLandDetail(@Param('id') id: string) {
    return this.landsService.findByIdFull(id);
  }

  @Post('reservations')
  @ApiOperation({
    summary: 'Reserve a land for a client',
    description:
      'Atomically reserves a land: checks availability, creates reservation, updates land status, ' +
      'creates/fetches client user in Core, and sends portal access email. Returns 409 on race condition.',
  })
  @ApiResponse({ status: 201, description: 'Land reserved successfully.' })
  @ApiResponse({ status: 404, description: 'Land not found.' })
  @ApiResponse({
    status: 409,
    description: 'Land already reserved (race condition).',
  })
  async reserveLand(@CurrentUser() user: RequestUser, @Body() dto: CreateLandReservationDto) {
    return this.reservationsService.create(user.id, dto);
  }

  @Get('reservations/mine')
  @ApiOperation({ summary: 'List my reservations' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'],
    description: 'Filter by reservation status',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by client name or email',
  })
  async getMyReservations(
    @CurrentUser() user: RequestUser,
    @Query() pagination: PaginationQueryDto,
    @Query() filters: LandReservationFilterDto,
  ) {
    return this.reservationsService.findByAgent(user.id, pagination, filters);
  }

  @Get('reservations/:id')
  @ApiOperation({ summary: 'Get reservation detail' })
  @ApiParam({ name: 'id', description: 'Reservation ID' })
  async getReservation(@Param('id') id: string) {
    return this.reservationsService.findOne(id);
  }

  @Post('reservations/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a reservation',
    description: 'Cancels a pending or confirmed reservation. Land becomes available again.',
  })
  @ApiParam({ name: 'id', description: 'Reservation ID' })
  @ApiResponse({ status: 200, description: 'Reservation cancelled.' })
  @ApiResponse({
    status: 403,
    description: 'Cannot cancel completed reservation.',
  })
  async cancelReservation(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CancelLandReservationDto,
  ) {
    return this.reservationsService.cancel(id, user.id, dto);
  }
}
