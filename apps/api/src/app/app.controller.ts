import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

// A20. This route is guarded by the global JwtAuthGuard (it is not @Public), so
// it requires a bearer token - and the published contract must say so. Without
// @ApiBearerAuth the OpenAPI document showed it as open, a contract wider than
// the guard enforces. Narrowing the document rather than widening the guard: the
// auth-required default is the safe posture, and liveness has its own public
// route on the health controller.
@ApiTags('app')
@ApiBearerAuth()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }
}
