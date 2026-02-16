import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProgressService } from './progress.service';
import { AuthenticatedRequest } from '@kambriq/shared';
import { CreateProgressDto } from './dto/create-progress.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('kbs/progress')
export class ProgressController {
  constructor(private progressService: ProgressService) {}

  @Post()
  markProgress(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateProgressDto,
  ) {
    return this.progressService.createOrUpdate(req.user.userId, dto);
  }

  @Get()
  getMyProgress(@Req() req: AuthenticatedRequest) {
    return this.progressService.getProgressByCandidate(req.user.userId);
  }
}
