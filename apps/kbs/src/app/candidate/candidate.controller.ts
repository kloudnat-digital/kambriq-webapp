import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CandidateService } from './candidate.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('kbs/candidate')
export class CandidateController {
  constructor(private readonly candidateService: CandidateService) {}

  @Post()
  async enroll(@Body() dto: CreateCandidateDto) {
    return this.candidateService.enroll(dto);
  }

  @Get(':userId')
  async getByUserId(@Param('userId') userId: string) {
    return this.candidateService.getByUserId(userId);
  }

  @Patch(':userId')
  async update(
    @Param('userId') userId: string,
    @Body() dto: UpdateCandidateDto,
  ) {
    return this.candidateService.updateCandidate(userId, dto);
  }

  @Get()
  async getAll() {
    return this.candidateService.listAll();
  }
}
