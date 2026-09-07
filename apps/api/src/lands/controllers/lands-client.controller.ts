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
import { LandReservationsService } from '../reservations/reservations.service';
import { PaymentsService } from '../payments/payments.service';
import { PreferredChannelDto } from '../payments/dto/payments.dto';
import { GetClientDocumentUploadUrlDto, RegisterClientDocumentDto } from '../dto/lands.dto';

@ApiTags('LANDS - Client')
@ApiBearerAuth()
@Controller('lands/client')
@Roles(RoleCode.CLIENT)
export class LandsClientController {
  constructor(
    private readonly reservationsService: LandReservationsService,
    private readonly payments: PaymentsService,
  ) {}

  @Get('purchases')
  @ApiOperation({
    summary: 'List my land purchases',
    description:
      'Returns all reservations linked to the authenticated client user, with land details and journey step progress.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  async getMyPurchases(@CurrentUser() user: RequestUser, @Query() pagination: PaginationQueryDto) {
    return this.reservationsService.findByClient(user.id, pagination);
  }

  @Get('purchases/:id')
  @ApiOperation({
    summary: 'Get purchase detail',
    description:
      'Full reservation detail including all 6 journey step timestamps for the purchase tracker.',
  })
  @ApiParam({ name: 'id', description: 'Reservation ID' })
  async getPurchaseDetail(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.reservationsService.findOneForClient(user.id, id);
  }

  @Post('purchases/:id/documents/upload-url')
  @ApiOperation({
    summary: 'Generate a presigned S3 upload URL for a client document',
    description:
      'Returns { uploadUrl, fileUrl } where fileUrl is the S3 key to pass back to /documents.',
  })
  @ApiParam({ name: 'id', description: 'Reservation ID' })
  async getDocumentUploadUrl(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: GetClientDocumentUploadUrlDto,
  ) {
    return this.reservationsService.getClientDocumentUploadUrl(user.id, id, dto);
  }

  @Post('purchases/:id/documents')
  @ApiOperation({
    summary: 'Register an uploaded client document',
    description:
      'Records the document after the S3 upload completed. Soft-deletes any previous active doc for the same type.',
  })
  @ApiParam({ name: 'id', description: 'Reservation ID' })
  async registerDocument(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: RegisterClientDocumentDto,
  ) {
    return this.reservationsService.registerClientDocument(user.id, id, dto);
  }

  @Delete('purchases/:id/documents/:documentId')
  @ApiOperation({
    summary: 'Delete an uploaded client document (soft delete)',
    description:
      'Marks the document as deleted. Allowed only while docs have not been validated by admin.',
  })
  @ApiParam({ name: 'id', description: 'Reservation ID' })
  @ApiParam({ name: 'documentId', description: 'Document ID' })
  async deleteDocument(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.reservationsService.deleteClientDocument(user.id, id, documentId);
  }

  // ----- G9: the payment entry point ----- //

  @Post('purchases/:id/payment')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Request a payment for this purchase',
    description:
      'Creates the payment for the acompte and returns it with its reference. **The client is ' +
      'who creates a payment** - the design gives INITIE a "Qui le declenche" of "Le client, sur ' +
      'la plateforme". There is no amount on the wire: it is read from the reservation, because ' +
      'a caller who can name their own amount can decide what they owe. ' +
      'Creation writes its own audit entry. The coordinates are NOT sent from here: v03 makes ' +
      "that the back office's act, taken after the identity is verified and a channel agreed. " +
      'The client states a preference and waits to be answered.',
  })
  @ApiParam({ name: 'id', description: 'Reservation ID' })
  @ApiResponse({ status: 201, description: 'Payment created, or the live one returned unchanged.' })
  @ApiResponse({ status: 400, description: 'The reservation is cancelled, or carries no acompte.' })
  @ApiResponse({ status: 403, description: 'The reservation belongs to somebody else.' })
  async requestPayment(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.payments.requestPaymentForReservation(user.id, id);
  }

  @Patch('payments/:id/preferred-channel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'State which way of paying suits me',
    description:
      "Records the client's **declared preference** on the payment, and keeps it on their " +
      'profile so the next request proposes it by default. v03 section 4c: it binds nothing. ' +
      'The back office sees it, takes it into account, and may answer with a different channel - ' +
      'an amount, a country of origin or an incomplete identification can make one unsuitable, ' +
      'and that is known during the conversation. Written only to `preferredChannel`; the ' +
      'authoritative `channel` is set by the back office when it sends.',
  })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiResponse({ status: 200, description: 'Preference recorded.' })
  @ApiResponse({ status: 400, description: 'Not one of the six ways to pay.' })
  @ApiResponse({ status: 403, description: 'The payment belongs to somebody else.' })
  async setPreferredChannel(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: PreferredChannelDto,
  ) {
    return this.payments.setPreferredChannel(user.id, id, dto.preferredChannel ?? null);
  }

  @Get('payments/:id')
  @ApiOperation({
    summary: 'My payment, with its coordinates once they have been sent',
    description:
      'The coordinates for the chosen channel, behind this authentication - v03 section 4d: ' +
      '**this is where they live, not in an email**. Before the back office has chosen, the ' +
      "payment is returned without them and with the reason it is still waiting. The client's " +
      'own declared preference is shown throughout, so they can see their request was heard.',
  })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiResponse({ status: 200, description: 'Payment returned.' })
  @ApiResponse({ status: 403, description: 'The payment belongs to somebody else.' })
  async getMyPayment(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.payments.findForClient(user.id, id);
  }
}
