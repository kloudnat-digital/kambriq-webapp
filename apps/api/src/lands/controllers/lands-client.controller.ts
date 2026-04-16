import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentUser, PaginationQueryDto, RequestUser, RoleCode, Roles } from '@kambriq/common';
import { LandReservationsService } from '../reservations/reservations.service';

@ApiTags('LANDS - Client')
@ApiBearerAuth()
@Controller('lands/client')
@Roles(RoleCode.CLIENT)
export class LandsClientController {
  constructor(private readonly reservationsService: LandReservationsService) {}

  @Get('purchases')
  @ApiOperation({
    summary: 'List my land purchases',
    description:
      'Returns all reservations linked to the authenticated client user, with land details and journey step progress.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  async getMyPurchases(@CurrentUser() user: RequestUser, @Query() pagination: PaginationQueryDto) {
    return this.reservationsService.findByClient(user.id, pagination);
  }

  @Get('purchases/:id')
  @ApiOperation({
    summary: 'Get purchase detail',
    description:
      'Full reservation detail including all 6 journey step timestamps for the purchase tracker.',
  })
  @ApiParam({ name: 'id', description: 'Reservation ID' })
  async getPurchaseDetail(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.reservationsService.findOneForClient(user.id, id);
  }
}
