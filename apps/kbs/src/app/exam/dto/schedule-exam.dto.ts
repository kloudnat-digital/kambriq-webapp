import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class ScheduleExamDto {
  @IsString()
  @IsNotEmpty()
  candidateId: string;

  @IsDateString()
  @IsNotEmpty()
  scheduledAt: string;
}
