import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, PaginationQueryDto, RequestUser, RoleCode, Roles } from '@kambriq/common';
import { PaymentsService } from '../payments/payments.service';
import {
  ProofUploadUrlDto,
  RecordReceiptDto,
  TransitionPaymentDto,
  ValidatePaymentDto,
} from '../payments/dto/payments.dto';

/**
 * G4 - the back office for payments.
 *
 * ---------------------------------------------------------------------------
 * Who may record, and who may validate
 * ---------------------------------------------------------------------------
 * **Recording is `ADMIN_LANDS`. Validating is `ADMIN_GLOBAL`.**
 *
 * Recording an encaissement is data entry: somebody reads a transfer receipt
 * and enters what it says. It is done often, by whoever handles the dossier,
 * and it commits nothing - the ledger grows, the payment does not move.
 *
 * Validating **commits money**. It says the platform agrees the payment is
 * settled, and everything downstream - the sale, the commission, the title -
 * rests on it. That is why it sits one role higher, and `ADMIN_GLOBAL` implies
 * `ADMIN_LANDS`, so a global admin can also record without a second grant.
 *
 * This is also what makes the deferred four-eyes rule cheap to add: with the
 * two acts already separated by role, the rule becomes a check on **identity**
 * within the validate path rather than a redesign. The seam is
 * `PaymentsService.assertFourEyesIfRequired`, called before the transition.
 *
 * The class-level `@Roles` is pinned by `route-guards.spec.ts`: deleting it
 * would downgrade this controller to "any authenticated user" without changing
 * a single response shape.
 */
@ApiTags('Payments (Admin)')
@ApiBearerAuth()
@Controller('lands/admin/payments')
@Roles(RoleCode.ADMIN_LANDS, RoleCode.ADMIN_GLOBAL)
export class PaymentsAdminController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @ApiOperation({
    summary: '[Admin] List payments with their state, reference and outstanding balance',
    description:
      'The outstanding balance is computed from the movement ledger on every read. There is no ' +
      'stored balance column, and adding one would be the defect G1 exists to prevent.',
  })
  @ApiResponse({ status: 200, description: 'Paginated payments.' })
  async list(@Query() query: PaginationQueryDto) {
    return this.payments.listForBackOffice(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: '[Admin] One payment, with its ledger and its full history',
    description:
      'Receipts oldest first, transitions oldest first. `amountReceived` and `outstanding` are ' +
      'computed; the columns do not exist.',
  })
  @ApiParam({ name: 'id', description: 'Payment ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Payment found.' })
  @ApiResponse({ status: 404, description: 'Payment not found.' })
  async findOne(@Param('id') id: string) {
    return this.payments.findForBackOffice(id);
  }

  @Post(':id/proof-upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Admin] Presigned URL to upload one proof',
    description:
      'Returns { uploadUrl, key }. PUT the file to uploadUrl, then send the key as `evidenceUrl` ' +
      'when recording the receipt. The object is private: a proof is evidence in a money dispute ' +
      'and outlives the payment, so it is never publicly readable.',
  })
  @ApiResponse({ status: 200, description: 'Presigned upload URL returned.' })
  @ApiResponse({ status: 400, description: 'Content type not accepted as a proof.' })
  async proofUploadUrl(@Param('id') id: string, @Body() dto: ProofUploadUrlDto) {
    return this.payments.getProofUploadUrl(id, dto);
  }

  @Get(':id/receipts/:receiptId/proof')
  @ApiOperation({
    summary: '[Admin] A short-lived link to read one proof',
    description: 'Never a public URL. The link expires; the object stays private.',
  })
  @ApiResponse({ status: 200, description: 'Presigned download URL returned.' })
  @ApiResponse({ status: 404, description: 'Receipt not found, or it carries no proof.' })
  async proofDownloadUrl(@Param('id') id: string, @Param('receiptId') receiptId: string) {
    return this.payments.getProofDownloadUrl(id, receiptId);
  }

  @Post(':id/receipts')
  @Roles(RoleCode.ADMIN_LANDS, RoleCode.ADMIN_GLOBAL)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '[Admin] Record an encaissement',
    description:
      'Appends one line to the movement ledger. **Changes no state.** Recording what arrived and ' +
      'agreeing that it settles the payment are two acts, and this is the first. A correction is ' +
      'a new signed line pointing at the line it corrects, never an edit - the database refuses ' +
      'an UPDATE on this table.',
  })
  @ApiResponse({ status: 201, description: 'Receipt recorded.' })
  @ApiResponse({ status: 400, description: 'Missing proof, zero amount, or a currency mismatch.' })
  @ApiResponse({ status: 404, description: 'Payment not found.' })
  async recordReceipt(
    @Param('id') id: string,
    @Body() dto: RecordReceiptDto,
    @CurrentUser() admin: RequestUser,
  ) {
    return this.payments.recordReceipt(
      id,
      {
        amount: BigInt(dto.amount),
        currency: dto.currency,
        channel: dto.channel,
        receivedAt: new Date(dto.receivedAt),
        evidenceUrl: dto.evidenceUrl,
        correctsId: dto.correctsId,
        note: dto.note,
      },
      admin.id,
    );
  }

  @Post(':id/transition')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Admin] Move a payment one legal step',
    description:
      'Moves the payment to `to`, if the transition table allows it from where it is now. The ' +
      'reason is required and is written to the audit trail. **Moves state and touches no money** ' +
      '- recording an encaissement is a different call, and always was. ' +
      'A target that commits money (PARTIELLEMENT_RECU, VALIDE, REJETE, ANNULE) requires ' +
      'ADMIN_GLOBAL; the bookkeeping steps in between are open to ADMIN_LANDS.',
  })
  @ApiResponse({ status: 200, description: 'Payment moved.' })
  @ApiResponse({ status: 400, description: 'A blank reason, or a step the table does not allow.' })
  @ApiResponse({ status: 403, description: 'A committing state without ADMIN_GLOBAL.' })
  async transition(
    @Param('id') id: string,
    @Body() dto: TransitionPaymentDto,
    @CurrentUser() admin: RequestUser,
  ) {
    return this.payments.transitionAsAdmin(id, dto.to, {
      actorUserId: admin.id,
      reason: dto.reason,
      roles: admin.roles ?? [],
    });
  }

  @Post(':id/validate')
  @Roles(RoleCode.ADMIN_GLOBAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Admin] Validate a payment',
    description:
      'Moves the payment to VALIDE. **Requires ADMIN_GLOBAL**, one role above recording, because ' +
      'this is the act that commits money. The reason is required and is written to the audit ' +
      'trail with the receipt it rests on. Recording a receipt never does this.',
  })
  @ApiResponse({ status: 200, description: 'Payment validated.' })
  @ApiResponse({ status: 400, description: 'A blank reason, or an illegal transition.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions. Requires ADMIN_GLOBAL.' })
  async validate(
    @Param('id') id: string,
    @Body() dto: ValidatePaymentDto,
    @CurrentUser() admin: RequestUser,
  ) {
    return this.payments.validate(id, {
      actorUserId: admin.id,
      reason: dto.reason,
      evidenceReceiptId: dto.evidenceReceiptId,
    });
  }
}
