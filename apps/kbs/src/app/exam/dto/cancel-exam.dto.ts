import { IsOptional, IsString } from 'class-validator';

export class CancelExamDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
