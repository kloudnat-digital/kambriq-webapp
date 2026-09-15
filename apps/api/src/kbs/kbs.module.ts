import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { KbsCandidateController } from './controllers/kbs-candidate.controller';
import { KbsAdminController } from './controllers/kbs-admin.controller';
import { KbsPublicController } from './controllers/kbs-public.controller';
import { KbsPrismaService } from './prisma/kbs-prisma.service';
import { EmailService, StorageService } from '@kambriq/common';
import { KbsCoursesService } from './courses/courses.service';
import { KbsCandidatesService } from './candidates/candidates.service';
import { KbsExamService } from './exam/exam.service';
import { KbsCertificatesService } from './certificates/certificates.service';
import { KbsGradingProcessor } from './exam/grading-processor';
import { KbsSettingsService } from './settings/settings.service';
import { KbsCertificateExpiryScheduler } from './certificates/certificate-expiry.scheduler';

@Module({
  imports: [CoreModule],
  controllers: [KbsCandidateController, KbsAdminController, KbsPublicController],
  providers: [
    EmailService,
    KbsPrismaService,
    StorageService,
    KbsCoursesService,
    KbsCandidatesService,
    KbsExamService,
    KbsSettingsService,
    KbsCertificatesService,
    KbsGradingProcessor,
    KbsCertificateExpiryScheduler,
  ],
  // Export services needed by other modules (e.g., HealthModule)
  exports: [KbsCandidatesService, KbsCertificatesService, KbsPrismaService],
})
export class KbsModule {}
