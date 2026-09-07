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
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, PaginationQueryDto, RequestUser, RoleCode, Roles } from '@kambriq/common';
import { LandReservationsService } from '../reservations/reservations.service';
import { PaymentsService } from '../payments/payments.service';
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
      'Creation writes its own audit entry, and sending the instructions is a separate call.',
  })
  @ApiParam({ name: 'id', description: 'Reservation ID' })
  @ApiResponse({ status: 201, description: 'Payment created, or the live one returned unchanged.' })
  @ApiResponse({ status: 400, description: 'The reservation is cancelled, or carries no acompte.' })
  @ApiResponse({ status: 403, description: 'The reservation belongs to somebody else.' })
  async requestPayment(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.payments.requestPaymentForReservation(user.id, id);
  }

  @Post('payments/:id/instructions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send me my payment instructions',
    description:
      'Emails the instructions for this payment and moves it to INSTRUCTIONS_ENVOYEES. ' +
      '**A separate act from creating the payment**: if the send fails the payment still ' +
      'exists, and the client can ask again. The send happens before the transition, so the ' +
      'state never claims an email that did not leave.',
  })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiResponse({ status: 200, description: 'Instructions sent.' })
  @ApiResponse({ status: 403, description: 'The payment belongs to somebody else.' })
  async sendMyInstructions(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.payments.requestInstructions(user.id, id, {
      email: user.email,
      lang: user.lang,
    });
  }
}
