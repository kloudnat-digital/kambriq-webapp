import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { StorageService } from '@kambriq/common';
import { LandsPrismaService } from './prisma/lands-prisma.service';
import { LandsService } from './lands.service';
import { LandsLabelsService } from './labels/labels.service';
import { LandReservationsService } from './reservations/reservations.service';
import { LandsAgentController } from './controllers/lands-agent.controller';
import { LandsAdminController } from './controllers/lands-admin.controller';
import { LandsClientController } from './controllers/lands-client.controller';

/**
 * LANDS Module — Land Inventory & Sales
 *
 * The LANDS module manages the core product — verified land parcels:
 * - Land parcels (CRUD, publishing, archiving)
 * - Labels (TDT, VEFL, VEFIL land classification)
 * - Media (public images, maps via S3)
 * - Documents (private legal files via S3)
 * - Reservations (agent reserves land for client, concurrency-safe)
 * - Price history (automatic tracking on every price change)
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
  ],
  exports: [LandsService, LandReservationsService, LandsPrismaService],
})
export class LandsModule {}
