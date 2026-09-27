import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { CmsWebhooksController } from './cms-webhooks.controller';
import { PolicyArchiveService } from './policy-archive.service';
import { SanityWebhookGuard } from './sanity-webhook.guard';

/** Receives content events from Sanity. `CoreModule` supplies `CorePrismaService`. */
@Module({
  imports: [CoreModule],
  controllers: [CmsWebhooksController],
  providers: [PolicyArchiveService, SanityWebhookGuard],
})
export class CmsModule {}
