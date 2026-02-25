import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { KbsCertificatesModule } from '../kbs/certificates/certificates.module';
import { KamnetPrismaService } from './prisma/kamnet-prisma.service';
import { KamnetApplicationsService } from './applications/applications.service';
import { KamnetAgentsService } from './agents/agents.service';
import { KamnetLeadsService } from './leads/leads.service';
import { KamnetCommissionsService } from './commissions/commissions.service';
import { KamnetNetworkService } from './network/network.service';
import { KamnetProcessor } from './processors/kamnet.processor';
import { KamnetAgentController } from './controllers/kamnet-agent.controller';
import { KamnetAdminController } from './controllers/kamnet-admin.controller';

/**
 *
 * The KAMNET module manages the certified agent network:
 * - Applications (KCA-certified users apply to become agents)
 * - Agent profiles (status management, sponsorship tree)
 * - Leads (prospect tracking for agents)
 * - Commissions (MVP: manual storage, v2: auto-calculation)
 * - Network (sponsorship tree queries, N1-N3 depth)
 *
 */

@Module({
  imports: [CoreModule, KbsCertificatesModule],
  providers: [
    KamnetPrismaService,
    KamnetApplicationsService,
    KamnetAgentsService,
    KamnetLeadsService,
    KamnetCommissionsService,
    KamnetNetworkService,
    KamnetProcessor,
  ],
  controllers: [KamnetAgentController, KamnetAdminController],
  exports: [KamnetPrismaService, KamnetAgentsService],
})
export class KamnetModule {}
