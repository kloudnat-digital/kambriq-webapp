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
import { CurrentUser, PaginationQueryDto, RequestUser, RoleCode, Roles } from '@kambriq/common';
import { LandsService } from '../lands.service';
import { LandsLabelsService } from '../labels/labels.service';
import { LandReservationsService } from '../reservations/reservations.service';
import {
  CreateLandDto,
  UpdateLandDto,
  LandFilterDto,
  CreateLabelDto,
  UpdateLabelDto,
  AddMediaDto,
  AddDocumentDto,
  GetUploadUrlDto,
  LandReservationFilterDto,
  CancelLandReservationDto,
  InviteClientDto,
} from '../dto/lands.dto';

@ApiTags('LANDS - Admin')
@ApiBearerAuth()
@Controller('lands/admin')
@Roles(RoleCode.ADMIN_LANDS, RoleCode.ADMIN_GLOBAL)
export class LandsAdminController {
  constructor(
    private readonly landsService: LandsService,
    private readonly labelsService: LandsLabelsService,
    private readonly reservationsService: LandReservationsService,
  ) {}

  @Post('invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Invite a client to create their account',
    description:
      'Creates a client account if it does not exist and sends a set-password invitation email. ' +
      'If the account already exists, resends the invitation. ' +
      'This is a manual trigger — invitations are also sent automatically on reservation.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Invitation sent. Returns client user ID and whether the account was newly created.',
  })
  async inviteClient(@Body() dto: InviteClientDto) {
    return this.reservationsService.inviteClient(dto.email, dto.firstName, dto.lastName, dto.phone);
  }

  @Post('labels')
  @ApiOperation({ summary: 'Create a land label (TFL, VEFL, VEFIL)' })
  @ApiResponse({ status: 201, description: 'Label created.' })
  @ApiResponse({ status: 409, description: 'Label code already exists.' })
  async createLabel(@Body() dto: CreateLabelDto) {
    return this.labelsService.create(dto);
  }

  @Get('labels')
  @ApiOperation({ summary: 'List all land labels' })
  async listLabels() {
    return this.labelsService.findAll();
  }

  @Patch('labels/:id')
  @ApiOperation({ summary: 'Update a land label' })
  @ApiParam({ name: 'id', description: 'Label ID' })
  async updateLabel(@Param('id') id: string, @Body() dto: UpdateLabelDto) {
    return this.labelsService.update(id, dto);
  }

  @Delete('labels/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a land label (if not in use)' })
  @ApiParam({ name: 'id', description: 'Label ID' })
  @ApiResponse({ status: 204, description: 'Label deleted.' })
  @ApiResponse({ status: 409, description: 'Label in use by lands.' })
  async deleteLabel(@Param('id') id: string) {
    return this.labelsService.delete(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new land parcel',
    description: 'Creates a new land record. Slug is auto-generated from title if not provided.',
  })
  @ApiResponse({ status: 201, description: 'Land created.' })
  @ApiResponse({
    status: 409,
    description: 'Slug or title number already exists.',
  })
  async createLand(@CurrentUser() user: RequestUser, @Body() dto: CreateLandDto) {
    return this.landsService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'List all lands (admin view — includes unpublished)',
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
    name: 'status',
    required: false,
    enum: ['AVAILABLE', 'RESERVED', 'SOLD', 'ARCHIVED'],
    description: 'Filter by land status',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by title or title number',
  })
  async listLands(@Query() pagination: PaginationQueryDto, @Query() filters: LandFilterDto) {
    return this.landsService.findAll(pagination, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full land detail (admin view)' })
  @ApiParam({ name: 'id', description: 'Land ID' })
  async getLand(@Param('id') id: string) {
    return this.landsService.findByIdFull(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a land parcel',
    description:
      'Updates land fields. If price changes, a price history record is created automatically.',
  })
  @ApiParam({ name: 'id', description: 'Land ID' })
  async updateLand(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateLandDto,
  ) {
    return this.landsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Archive a land parcel',
    description: 'Soft-delete: sets status to ARCHIVED and unpublishes. Does not remove from DB.',
  })
  @ApiParam({ name: 'id', description: 'Land ID' })
  async archiveLand(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.landsService.archive(id, user.id);
  }

  @Post('media')
  @ApiOperation({ summary: 'Add media to a land (after S3 upload)' })
  @ApiResponse({ status: 201, description: 'Media record created.' })
  async addMedia(@Body() dto: AddMediaDto) {
    return this.landsService.addMedia(dto);
  }

  @Delete('media/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete media from a land (S3 + DB)' })
  @ApiParam({ name: 'id', description: 'Media ID' })
  async deleteMedia(@Param('id') id: string) {
    return this.landsService.deleteMedia(id);
  }

  @Post('documents')
  @ApiOperation({ summary: 'Add a document to a land (after S3 upload)' })
  @ApiResponse({ status: 201, description: 'Document record created.' })
  async addDocument(@CurrentUser() user: RequestUser, @Body() dto: AddDocumentDto) {
    return this.landsService.addDocument(dto, user.id);
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a document (S3 + DB)' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  async deleteDocument(@Param('id') id: string) {
    return this.landsService.deleteDocument(id);
  }

  @Post(':id/upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate presigned S3 upload URL for a land',
    description:
      'Frontend uses this URL to upload files directly to S3. Returns { uploadUrl, fileUrl }.',
  })
  @ApiParam({ name: 'id', description: 'Land ID' })
  async getUploadUrl(@Param('id') landId: string, @Body() dto: GetUploadUrlDto) {
    return this.landsService.getUploadUrl(landId, dto);
  }

  @Get(':id/price-history')
  @ApiOperation({ summary: 'Get price change history for a land' })
  @ApiParam({ name: 'id', description: 'Land ID' })
  async getPriceHistory(@Param('id') id: string) {
    return this.landsService.getPriceHistory(id);
  }

  @Get('reservations')
  @ApiOperation({ summary: 'List all land reservations' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'],
    description: 'Filter by reservation status',
  })
  @ApiQuery({
    name: 'agentUserId',
    required: false,
    type: String,
    description: 'Filter by agent user ID',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by client name or email',
  })
  async listReservations(
    @Query() pagination: PaginationQueryDto,
    @Query() filters: LandReservationFilterDto,
  ) {
    return this.reservationsService.findAll(pagination, filters);
  }

  @Post('reservations/:id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm down payment for a reservation',
    description: 'Marks the 5% down payment as received. Reservation becomes CONFIRMED.',
  })
  @ApiParam({ name: 'id', description: 'Reservation ID' })
  async confirmReservation(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.reservationsService.confirmDownPayment(id, user.id);
  }

  @Post('reservations/:id/documents-received')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Step 3 — Mark client documents as received',
    description:
      'Records that the client has submitted their required documents (ID, proof of address, etc.). Requires step 2 (down payment confirmed) to be done first.',
  })
  @ApiParam({ name: 'id', description: 'Reservation ID' })
  async markDocumentsReceived(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.reservationsService.markDocumentsReceived(id, user.id);
  }

  @Post('reservations/:id/payment-confirmed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Step 4 — Confirm remaining payment received',
    description:
      'Records that the remaining balance has been received. Requires step 3 (documents received) to be done first.',
  })
  @ApiParam({ name: 'id', description: 'Reservation ID' })
  async confirmRemainingPayment(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.reservationsService.confirmRemainingPayment(id, user.id);
  }

  @Post('reservations/:id/dossier-started')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Step 5 — Start dossier / title transfer',
    description:
      'Records that the title transfer process has been initiated. Requires step 4 (remaining payment confirmed) to be done first.',
  })
  @ApiParam({ name: 'id', description: 'Reservation ID' })
  async startDossier(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.reservationsService.startDossier(id, user.id);
  }

  @Post('reservations/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Step 6 — Complete a sale (finalize reservation)',
    description:
      'Marks reservation as COMPLETED and land as SOLD. Only confirmed reservations can be completed.',
  })
  @ApiParam({ name: 'id', description: 'Reservation ID' })
  async completeReservation(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.reservationsService.complete(id, user.id);
  }

  @Post('reservations/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a reservation (admin override)' })
  @ApiParam({ name: 'id', description: 'Reservation ID' })
  async cancelReservation(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CancelLandReservationDto,
  ) {
    return this.reservationsService.cancel(id, user.id, dto);
  }
}
