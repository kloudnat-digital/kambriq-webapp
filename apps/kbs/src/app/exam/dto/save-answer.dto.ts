import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SaveAnswerDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsString()
  @IsOptional()
  answerId?: string;

  @IsBoolean()
  @IsOptional()
  flagged?: boolean;
}
