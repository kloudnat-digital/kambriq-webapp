import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { QueueHealthService } from './queue-health.service';
import { CoreModule } from '../core/core.module';
import { KbsModule } from '../kbs/kbs.module';

@Module({
  // Import modules that provide the Prisma services used by the controller
  imports: [TerminusModule, CoreModule, KbsModule],
  controllers: [HealthController],
  // The queues themselves come from the global QueueModule, which registers all
  // five and exports BullModule.
  //
  // It said "four" while QueueModule registered five, and `QueueHealthService`
  // injected four to match. So `/health/queues` answered 200 with a complete
  // list that was missing `dunning` entirely, and the comment made the omission
  // read as a decision. G6's sweep had nowhere visible to fail: a queue nobody
  // can query is a queue nobody can find work stuck in.
  //
  // A defect in the measurement rather than in the thing measured - the queue
  // was registered the whole time.
  providers: [QueueHealthService],
})
export class HealthModule {}
