import { IsDateString, IsNotEmpty } from 'class-validator';

export class RescheduleExamDto {
  @IsDateString()
  @IsNotEmpty()
  scheduledAt: string;
}
