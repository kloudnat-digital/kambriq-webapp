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
      'Public endpoint to verify the authenticity and validity of a KCA certificate. `status` is the verdict: VALID, EXPIRED, REVOKED, or UNKNOWN for a number the register does not hold. No authentication required.',
  })
  @ApiParam({
    name: 'kcaNumber',
    description: 'KCA certificate number (format: KCA-YYYYMMDD-XXXX)',
    example: 'KCA-20240115-0042',
  })
  // One response, deliberately. An unknown number is an answer, not an error:
  // it returns 200 with status UNKNOWN. This used to declare a 404 the service
  // has never sent.
  @ApiResponse({
    status: 200,
    description:
      'The verdict: status VALID, EXPIRED or REVOKED with the certificate dates, or UNKNOWN with valid=false.',
  })
  async verifyCertificate(@Param('kcaNumber') kcaNumber: string) {
    return this.certificatesService.verifyCertificate(kcaNumber);
  }
}
