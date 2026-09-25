import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, PaginationQueryDto, RequestUser, RoleCode, Roles } from '@kambriq/common';
import { DunningService } from '../payments/dunning.service';
import { PaymentsService } from '../payments/payments.service';
import {
  ProofUploadUrlDto,
  RecordReceiptDto,
  SendInstructionsDto,
  TransitionPaymentDto,
  ValidatePaymentDto,
} from '../payments/dto/payments.dto';

/**
 * Back-office controller for payment management.
 *
 * Recording is restricted to `ADMIN_LANDS`, as it acts as unverified data entry
 * appending to the ledger without committing state.
 *
 * Validation is restricted to `ADMIN_GLOBAL`. It commits the funds and
 * authorizes downstream actions. Role separation enforces the four-eyes principle
 * by ensuring the validator is distinct from the recorder.
 */
@ApiTags('Payments (Admin)')
@ApiBearerAuth()
@Controller('lands/admin/payments')
@Roles(RoleCode.ADMIN_LANDS, RoleCode.ADMIN_GLOBAL)
export class PaymentsAdminController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly dunning: DunningService,
  ) {}

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

  // Declared **above** `@Get(':id')` deliberately: Express answers with the
  // first pattern that matches, so a literal segment placed after a `:id` route
  // in the same controller is answered by that route with id='requests'. This is
  // `controller-route-shadowing.spec.ts`'s rule one level down - between routes
  // of one class rather than between classes - and it is the same defect that
  // made `GET /lands/admin/payments` return "Parcelle de terrain introuvable".
  @Get('requests')
  @ApiOperation({
    summary: '[Admin] The queue of payment requests waiting for an answer',
    description:
      'Every payment still in INITIE, **oldest first**, with how long it has waited, the ' +
      "client's declared preference, and whether their identity has been verified. " +
      'v03 section 4d: a client who asked to pay and got no answer is exactly the silence this ' +
      'system exists to make impossible. `meta.oldestWaitingDays` ages the backlog as a whole. ' +
      '`blockedByIdentity` says whether a send would be refused right now, so the reviewer can ' +
      'tell a request waiting on the identity queue from one waiting on them.',
  })
  @ApiResponse({ status: 200, description: 'Requests returned, oldest first.' })
  async listRequests(@Query() pagination: PaginationQueryDto) {
    return this.payments.listRequests(pagination);
  }

  // Also above `@Get(':id')`, and for the same reason as `requests` - a literal
  // segment declared after a `:id` route is swallowed by it.
  @Get('overdue')
  @ApiOperation({
    summary: '[Admin] The queue of payments in souffrance, oldest deadline first',
    description:
      'Every payment still in INSTRUCTIONS_ENVOYEES whose validity period has elapsed - the ' +
      'client was told what to pay and how, and has not answered. **Oldest deadline first**, ' +
      'each row with `waitingDays` (age of the payment) and `overdueDays` (how far past its ' +
      'deadline), plus how many reminders have gone out and when the last one did. ' +
      'v03 *"Rien ne peut dormir en silence"*: a forgotten payment must not be able to keep ' +
      'quiet. `meta.oldestWaitingDays` ages the whole backlog, not this page. ' +
      'Payments that are VALIDE, REJETE, EXPIRE or ANNULE never appear here - the queue does ' +
      'not chase money that has arrived.',
  })
  @ApiResponse({ status: 200, description: 'Overdue payments returned, oldest deadline first.' })
  async listOverdue(@Query() pagination: PaginationQueryDto) {
    return this.dunning.listOverdueQueue(pagination);
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
        paidBy: dto.paidBy,
        correctsId: dto.correctsId,
        note: dto.note,
      },
      admin.id,
    );
  }

  @Post(':id/send-instructions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Admin] Choose the channel and release the coordinates',
    description:
      'The one place bank details leave the system, and it carries all three of v03 section 4d: ' +
      "the client's identity must be **verified** (not merely submitted), a channel must be " +
      "chosen, and a named person decides. The message carries only the chosen channel's " +
      "details. The coordinates render on the client's own page; the email is a notification " +
      'that contains none of them. The transition records who, when, which channel and why. ' +
      'Refused with the identity status when the client has not been verified.',
  })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiResponse({ status: 200, description: 'Coordinates released and notification sent.' })
  @ApiResponse({ status: 400, description: 'No reference, or a channel nobody may choose.' })
  @ApiResponse({ status: 403, description: 'The client identity is not verified.' })
  async sendInstructions(
    @Param('id') id: string,
    @Body() dto: SendInstructionsDto,
    @CurrentUser() admin: RequestUser,
  ) {
    return this.payments.sendInstructions(id, {
      actorUserId: admin.id,
      channel: dto.channel,
      reason: dto.reason,
    });
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
      'ADMIN_GLOBAL; the bookkeeping steps in between are open to ADMIN_LANDS. ' +
      '`evidenceReceiptId` names the encaissement the step rests on: required for ' +
      'PARTIELLEMENT_RECU, refused if it belongs to another payment, NULL for the steps that ' +
      'rest on no receipt.',
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
      evidenceReceiptId: dto.evidenceReceiptId,
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
      'trail with the receipt it rests on - `evidenceReceiptId` is required and must be one of ' +
      "this payment's own. Recording a receipt never does this.",
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
