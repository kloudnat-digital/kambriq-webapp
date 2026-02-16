import { PartialType } from '@nestjs/swagger';
import { CreateCertificateDto } from './create-certificat-dto';

export class UpdateCertificateDto extends PartialType(CreateCertificateDto) {}
