import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CertificateController } from './certificate/certificate.controller';
import { CertificateService } from './certificate/certificate.service';
import { CertificateModule } from './certificate/certificate.module';

@Module({
  imports: [CertificateModule],
  controllers: [AppController, CertificateController],
  providers: [AppService, CertificateService],
})
export class AppModule {}
