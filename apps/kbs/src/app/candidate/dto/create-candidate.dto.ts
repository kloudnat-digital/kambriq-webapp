import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { KBSCandidateStatus } from '@kambriq/shared';

export class CreateCandidateDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  @IsOptional()
  sponsorId?: string;

  @IsDateString()
  @IsOptional()
  enrollmentDate?: string;

  @IsEnum(KBSCandidateStatus)
  @IsOptional()
  status?: KBSCandidateStatus;

  @IsDateString()
  @IsOptional()
  examDueDate?: string;
}
