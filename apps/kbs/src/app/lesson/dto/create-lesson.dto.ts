import { IsNotEmpty, IsString } from 'class-validator';

export class CreateLessonDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  contentUrl: string;

  @IsNotEmpty()
  @IsString()
  moduleId: string;
}
