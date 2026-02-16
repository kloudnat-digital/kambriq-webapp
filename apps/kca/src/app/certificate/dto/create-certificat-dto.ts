import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class CreateCertificateDto {
  @IsNotEmpty()
  @IsString()
  candidateId: string;

  @IsNotEmpty()
  @IsDateString()
  validUntil: string;

  @IsNotEmpty()
  @IsString()
  pdfUrl: string;
}
