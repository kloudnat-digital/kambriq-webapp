import { PartialType } from '@nestjs/swagger';
import { CreateCandidateDto } from './create-candidate.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { KBSCandidateStatus } from '@kambriq/shared';

export class UpdateCandidateDto extends PartialType(CreateCandidateDto) {
  @IsEnum(KBSCandidateStatus)
  @IsOptional()
  status?: KBSCandidateStatus;
}
