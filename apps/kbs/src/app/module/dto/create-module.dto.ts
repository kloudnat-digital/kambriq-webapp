import { IsNotEmpty, IsString } from 'class-validator';

export class CreateModuleDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsString()
  courseId: string;
}
