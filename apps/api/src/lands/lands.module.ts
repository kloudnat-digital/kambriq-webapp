import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { StorageService } from '@kambriq/common';
import { LandsPrismaService } from './prisma/lands-prisma.service';
import { LandsService } from './lands.service';
import { LandsLabelsService } from './labels/labels.service';
import { LandReservationsService } from './reservations/reservations.service';
import { PaymentsService } from './payments/payments.service';
import { PaymentChannelsService } from './payments/payment-channels.service';
import { LandsAgentController } from './controllers/lands-agent.controller';
import { LandsAdminController } from './controllers/lands-admin.controller';
import { LandsClientController } from './controllers/lands-client.controller';
import { PaymentsAdminController } from './controllers/payments-admin.controller';

/**
 * LANDS Module - Land Inventory & Sales
 *
 * The LANDS module manages the core product - verified land parcels:
 * - Land parcels (CRUD, publishing, archiving)
 * - Labels (TFL, VEFL, VEFIL land classification)
 * - Media (public images, maps via S3)
 * - Documents (private legal files via S3)
 * - Reservations (agent reserves land for client, concurrency-safe)
 * - Price history (automatic tracking on every price change)
 * - Payments (G1 model and state machine, G2 reference, G3 instructions)
 *
 * `PaymentsService` and `PaymentChannelsService` are registered here by G3.
 * G1 added the service and never wired it into a module, so nothing could have
 * instantiated it - which nothing noticed, because nothing called it either.
 * `PaymentChannelsService` fails the boot if its SSM prefix is set and
 * incomplete, so a missing bank detail stops the application rather than
 * producing a message with a blank in it.
 */
@Module({
  imports: [CoreModule],
  /**
   * **Order is behaviour here, not tidiness.**
   *
   * Nest registers routes in this order and Express matches the first pattern
   * that fits. `LandsAdminController` is mounted at `lands/admin` and carries
   * `@Get(':id')`, so it answers `GET /lands/admin/payments` with
   * "Parcelle de terrain introuvable" - a 404 about a land, for a request about
   * the payment queue.
   *
   * That is exactly what happened: the controller, its guards, its DTOs and its
   * tests were all correct, `nx typecheck` and 429 unit tests were green, and
   * the screen was blank. The list route was being answered by a different
   * controller. **Only opening the page found it.**
   *
   * A controller whose path extends another's must be registered before it -
   * most specific first. `controller-route-shadowing.spec.ts` fails if that
   * stops being true, so the next one is caught by a test rather than by a
   * blank screen.
   *
   * `LandsClientController` ('lands/client') moved above `LandsAgentController`
   * ('lands') for the same reason, and that one is not currently broken: the
   * agent's `@Get(':id')` is two segments and every client route is three or
   * more, so nothing collides today. It collides the day somebody adds
   * `@Get(':id/anything')` to the agent controller - a change with no visible
   * connection to the client purchases screen that would break it. The general
   * rule found this; the specific pair above is what taught us to write it.
   */
  controllers: [
    PaymentsAdminController,
    LandsAdminController,
    LandsClientController,
    LandsAgentController,
  ],
  providers: [
    LandsPrismaService,
    StorageService,
    LandsService,
    LandsLabelsService,
    LandReservationsService,
    PaymentsService,
    PaymentChannelsService,
  ],
  exports: [LandsService, LandReservationsService, LandsPrismaService, PaymentsService],
})
export class LandsModule {}
