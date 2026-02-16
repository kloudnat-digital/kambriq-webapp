import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CourseService } from './course.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateCourseDto } from './dto/create-course.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('kbs/courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Post()
  create(@Body() dto: CreateCourseDto) {
    return this.courseService.createCourse(dto);
  }

  @Get()
  findAll() {
    return this.courseService.getAllCourses();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.courseService.getCourseById(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.courseService.deleteCourse(id);
  }
}
