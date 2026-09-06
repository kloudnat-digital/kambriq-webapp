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
  controllers: [LandsAdminController, LandsAgentController, LandsClientController],
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
