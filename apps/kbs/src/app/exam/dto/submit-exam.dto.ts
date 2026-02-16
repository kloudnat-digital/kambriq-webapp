import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExamAnswerDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsString()
  @IsOptional()
  answerId?: string;
}

export class SubmitExamDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamAnswerDto)
  answers: ExamAnswerDto[];
}
