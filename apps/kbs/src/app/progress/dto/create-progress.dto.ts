import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class CreateProgressDto {
  @IsNotEmpty()
  @IsString()
  moduleId: string;

  @IsNotEmpty()
  @IsDateString()
  completedAt: string;
}
