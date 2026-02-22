import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@kambriq/common';
import { KbsCertificatesService } from '../certificates/certificates.service';

@ApiTags('KBS - Public')
@Controller('kbs/public')
export class KbsPublicController {
  constructor(private readonly certificatesService: KbsCertificatesService) {}

  @Public()
  @Get('verify/:kcaNumber')
  @ApiOperation({
    summary: 'Verify a KCA certificate by number',
    description:
      'Public endpoint to verify the authenticity and validity of a KCA certificate. Returns certificate details and whether it is currently valid or expired. No authentication required.',
  })
  @ApiParam({
    name: 'kcaNumber',
    description: 'KCA certificate number (format: KCA-YYYYMMDD-XXXX)',
    example: 'KCA-20240115-0042',
  })
  @ApiResponse({
    status: 200,
    description:
      'Certificate found. Returns details and validity status (valid or expired).',
  })
  @ApiResponse({
    status: 404,
    description: 'No certificate found with this KCA number.',
  })
  async verifyCertificate(@Param('kcaNumber') kcaNumber: string) {
    return this.certificatesService.verifyCertificate(kcaNumber);
  }
}
