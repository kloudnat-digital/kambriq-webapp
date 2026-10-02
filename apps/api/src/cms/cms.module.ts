import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { CmsPoliciesController } from './cms-policies.controller';
import { CmsWebhooksController } from './cms-webhooks.controller';
import { PolicyArchiveService } from './policy-archive.service';
import { SanityWebhookGuard } from './sanity-webhook.guard';

/**
 * Receives content events from Sanity, and answers which legal revision is in
 * force (C41). `CoreModule` supplies `CorePrismaService`.
 */
@Module({
  imports: [CoreModule],
  controllers: [CmsWebhooksController, CmsPoliciesController],
  providers: [PolicyArchiveService, SanityWebhookGuard],
})
export class CmsModule {}
