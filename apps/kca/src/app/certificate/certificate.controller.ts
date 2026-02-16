import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CertificateService } from './certificate.service';
import { CreateCertificateDto } from './dto/create-certificat-dto';
import { UpdateCertificateDto } from './dto/update-certificate-dto';

@UseGuards(AuthGuard('jwt'))
@Controller('kca/certificate')
export class CertificateController {
  constructor(private certificateService: CertificateService) {}

  @Post()
  issue(@Body() dto: CreateCertificateDto) {
    return this.certificateService.create(dto);
  }

  @Get()
  findAll() {
    return this.certificateService.findAll();
  }

  @Get(':id') findOne(@Param('id') id: string) {
    return this.certificateService.findOne(id);
  }

  @Get(':candidateId')
  get(@Param('candidateId') candidateId: string) {
    return this.certificateService.findByCandidateId(candidateId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCertificateDto) {
    return this.certificateService.update(id, dto);
  }

  @Post('revoke/:id')
  revoke(@Param('id') id: string) {
    return this.certificateService.revoke(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.certificateService.delete(id);
  }
}
